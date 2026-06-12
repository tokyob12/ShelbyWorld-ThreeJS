import { getAptosWallets } from "@aptos-labs/wallet-standard";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const SHELBY_API = "https://api.shelbynet.shelby.xyz/shelby/v1/blobs";
const LEADERBOARD_BLOB = "leaderboard.json";

export class ShelbyManager {
  static walletAddress = null;
  static isConnected = false;
  static activeWallet = null;

  static SHELBY_MODULE_ADDRESS =
    "0x684a223128e42522169840148c8e70e46c785ca15f4582b89ca9118a7af28b53::game_protocol";
  static SPONSOR_PRIVATE_KEY_HEX = import.meta.env.VITE_SPONSOR_PRIVATE_KEY;

  // Lazily created — WASM erasure-coding provider init is expensive
  static _client = null;
  static _getClient() {
    if (!this._client) this._client = new ShelbyClient({ network: "shelbynet" });
    return this._client;
  }

  // Session cache of passports (walletAddress -> passport | null).
  // Lets save / post-mint refresh skip network reads, avoiding both the red
  // 404 on first-time players AND read-after-write races on the same session.
  static _passportCache = new Map();

  // ---------------------------------------------------------------------------
  // WALLET CONNECTION
  // ---------------------------------------------------------------------------

  static async getStandardWallet() {
    const { aptosWallets, on } = getAptosWallets();

    const getPreferred = (wallets) => {
      const petra = wallets.find((w) => w.name.includes("Petra"));
      return petra || (wallets.length > 0 ? wallets[0] : null);
    };

    const wallet = getPreferred(aptosWallets);
    if (wallet) return wallet;

    return new Promise((resolve) => {
      let resolved = false;
      const removeListener = on("register", () => {
        const { aptosWallets: updated } = getAptosWallets();
        const found = getPreferred(updated);
        if (found && !resolved) {
          resolved = true;
          removeListener();
          resolve(found);
        }
      });
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          removeListener();
          const { aptosWallets: final } = getAptosWallets();
          resolve(getPreferred(final) || null);
        }
      }, 1000);
    });
  }

  static async connectWallet() {
    try {
      const wallet = await this.getStandardWallet();
      if (!wallet) throw new Error("Aptos Wallet not found. Please install Petra.");

      const connectFeature = wallet.features["aptos:connect"];
      if (!connectFeature) throw new Error("Wallet does not support AIP-62 standard.");

      const response = await connectFeature.connect();
      const rawAddress =
        response.args?.address || response.account?.address || response.address;
      if (!rawAddress) throw new Error("Failed to retrieve wallet address.");

      this.walletAddress =
        typeof rawAddress === "string" ? rawAddress : rawAddress.toString();
      this.activeWallet = wallet;
      this.isConnected = true;

      const shortAddress = `${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(this.walletAddress.length - 4)}`;
      return { address: this.walletAddress, shortAddress };
    } catch (error) {
      console.error("Wallet connection failed:", error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // INTERNAL HELPERS
  // ---------------------------------------------------------------------------

  static _getSponsorSigner() {
    if (!this.SPONSOR_PRIVATE_KEY_HEX) {
      throw new Error("Sponsor private key not configured in .env file.");
    }
    const pKey = new Ed25519PrivateKey(this.SPONSOR_PRIVATE_KEY_HEX);
    return Account.fromPrivateKey({ privateKey: pKey });
  }

  // On-chain existence check via aptos.view() — HTTP 200 even when absent, so
  // it produces NO red 404 in the console (unlike a direct blob GET).
  static async _blobExists(account, name) {
    try {
      const meta = await this._getClient().coordination.getBlobMetadata({ account, name });
      return !!meta;
    } catch (_) {
      return false;
    }
  }

  // Direct blob GET. Returns null on 404, throws on other errors.
  // Reads the storage layer directly (no indexer) — immune to indexer lag.
  static async _fetchBlob(sponsorAddress, blobName) {
    const url = `${SHELBY_API}/${sponsorAddress}/${blobName}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch ${blobName}: ${res.status}`);
    return res.json();
  }

  // Delete-then-upload. Shelby blobs are immutable — overwriting different bytes
  // under the same registered name fails with HTTP 400 at multipart /complete.
  // The 1.5 s pause after deleteBlob lets the node sync before client.upload()
  // internally re-checks getBlobMetadata().
  static async _writeBlob(data, blobName, sponsorSigner) {
    const client = this._getClient();

    let existsMeta = null;
    try {
      existsMeta = await client.coordination.getBlobMetadata({
        account: sponsorSigner.accountAddress,
        name: blobName,
      });
    } catch (_) {}

    if (existsMeta) {
      console.log(`[SHELBY] Deleting old ${blobName} registration...`);
      const { transaction } = await client.coordination.deleteBlob({
        account: sponsorSigner,
        blobName,
      });
      await client.aptos.waitForTransaction({ transactionHash: transaction.hash });
      await new Promise((r) => setTimeout(r, 1500));
    }

    const blobData = new TextEncoder().encode(JSON.stringify(data));
    const expirationMicros = Date.now() * 1000 + 86400 * 30 * 1_000_000;

    await client.upload({ blobData, signer: sponsorSigner, blobName, expirationMicros });
    console.log(`[SHELBY] ✅ ${blobName} written → ${SHELBY_API}/${sponsorSigner.accountAddress}/${blobName}`);
  }

  // Merge newRecord into records, keeping personal best per wallet.
  static _mergeRecord(records, newRecord) {
    const map = new Map();
    for (const r of records) {
      if (!r.wallet_address) continue;
      const ex = map.get(r.wallet_address);
      if (!ex || r.score > ex.score || (r.score === ex.score && r.time_elapsed < ex.time_elapsed)) {
        map.set(r.wallet_address, r);
      }
    }
    const cur = map.get(newRecord.wallet_address);
    if (!cur || newRecord.score > cur.score || (newRecord.score === cur.score && newRecord.time_elapsed < cur.time_elapsed)) {
      map.set(newRecord.wallet_address, newRecord);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.score - a.score || a.time_elapsed - b.time_elapsed
    );
  }

  // ---------------------------------------------------------------------------
  // DYNAMIC PASSPORT — fetch (zero red 404, even for first-time players)
  // ---------------------------------------------------------------------------

  static async fetchPlayerPassport(walletAddress) {
    try {
      // Session cache is authoritative — instant, and correct right after a
      // write (no read-after-write race on the post-mint HUD refresh).
      if (this._passportCache.has(walletAddress)) {
        return this._passportCache.get(walletAddress);
      }

      const sponsorSigner = this._getSponsorSigner();
      const sponsorAddress = sponsorSigner.accountAddress.toString();
      const blobName = `${walletAddress}_passport.json`;

      // Existence check via on-chain view (HTTP 200) — no red 404 for new players
      const exists = await this._blobExists(sponsorSigner.accountAddress, blobName);
      if (!exists) {
        console.log(`[PASSPORT] No passport for ${walletAddress.substring(0, 8)}... (first-time player)`);
        this._passportCache.set(walletAddress, null);
        return null;
      }

      const passport = await this._fetchBlob(sponsorAddress, blobName);
      this._passportCache.set(walletAddress, passport);
      const best = passport?.attributes?.find((a) => a.trait_type === "Decryption Credits")?.value ?? "?";
      console.log(`[PASSPORT] ✅ Loaded — best score: ${best} CR`);
      return passport;
    } catch (err) {
      console.warn("[PASSPORT] Failed to fetch passport:", err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // DYNAMIC PASSPORT — save (reads prev from cache → no extra network 404)
  // ---------------------------------------------------------------------------

  static async savePlayerPassport(walletAddress, credits, timeElapsed) {
    try {
      const sponsorSigner = this._getSponsorSigner();
      const blobName = `${walletAddress}_passport.json`;

      // Previous state from the guarded fetch (cache hit, or 200 view-check) —
      // never a raw blob GET, so no red 404 here.
      const prev = await this.fetchPlayerPassport(walletAddress);

      const prevCredits = prev?.attributes?.find((a) => a.trait_type === "Decryption Credits")?.value ?? -1;
      const prevTime    = prev?.attributes?.find((a) => a.trait_type === "Speedrun Time")?.value ?? Infinity;
      const prevRuns    = prev?.attributes?.find((a) => a.trait_type === "Total Runs")?.value ?? 0;

      const isPersonalBest =
        credits > prevCredits || (credits === prevCredits && timeElapsed < prevTime);

      const bestCredits = isPersonalBest ? credits : prevCredits;
      const bestTime    = isPersonalBest ? timeElapsed : (prevTime === Infinity ? timeElapsed : prevTime);

      const passport = {
        name: "ShelbyWorld Quest — Portal Pass",
        description:
          "A dynamic on-chain passport minted via ShelbyWorld Quest. Attributes are mutable and update on every personal-best run — stored on Shelby decentralized hot storage.",
        image:
          "https://api.shelbynet.shelby.xyz/shelby/v1/blobs/0x236f14622de45f2f2246df2a0736d6ccbbbbbd23e4c7570ad3378cfdfaa589d5/model/logo.glb",
        external_url: "https://shelbyworld.netlify.app",
        attributes: [
          { trait_type: "Decryption Credits", value: bestCredits },
          { trait_type: "Speedrun Time",      value: bestTime },
          { trait_type: "Completed Levels",   value: 1 },
          { trait_type: "Outpost Secured",    value: "Yes" },
          { trait_type: "Total Runs",         value: prevRuns + 1 },
          { trait_type: "Network",            value: "Aptos Testnet" },
          { trait_type: "Storage Layer",      value: "Shelby Decentralized Storage" },
        ],
        wallet_address: walletAddress,
        last_updated: Date.now(),
      };

      console.log(
        `[PASSPORT] ${isPersonalBest ? "NEW PERSONAL BEST" : "Run logged"} — ${walletAddress.substring(0, 8)}... (best: ${bestCredits} CR)`
      );
      await this._writeBlob(passport, blobName, sponsorSigner);
      this._passportCache.set(walletAddress, passport); // refresh cache for instant HUD update
      return passport;
    } catch (err) {
      console.warn("[PASSPORT] Failed to save passport — game continues normally:", err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // SUBMIT FINAL SCORE
  // ---------------------------------------------------------------------------

  static async submitFinalScore(credits, timeElapsed) {
    if (!this.isConnected || !this.activeWallet) {
      throw new Error("Wallet not connected");
    }

    try {
      const txFeature = this.activeWallet.features["aptos:signAndSubmitTransaction"];
      if (!txFeature) throw new Error("Wallet does not support transaction signing.");

      const response = await txFeature.signAndSubmitTransaction({
        payload: {
          function: `${this.SHELBY_MODULE_ADDRESS}::mint_passport`,
          typeArguments: [],
          functionArguments: [credits.toString()],
        },
      });

      const txHash =
        response.hash ||
        response.transaction?.hash ||
        response.args?.hash ||
        response.id;
      if (!txHash) throw new Error("Failed to capture a valid transaction hash.");

      console.log("✅ On-chain Mint Tx:", txHash);

      const newRecord = {
        wallet_address: this.walletAddress,
        score: credits,
        time_elapsed: timeElapsed,
        tx_hash: txHash,
        timestamp: Date.now(),
      };

      try {
        localStorage.setItem(`shelby_score_${this.walletAddress}`, JSON.stringify(newRecord));
      } catch (e) {
        console.warn("Local backup write failed:", e);
      }

      // Update unified leaderboard blob (direct fetch — no indexer race)
      try {
        const sponsorSigner = this._getSponsorSigner();
        const sponsorAddress = sponsorSigner.accountAddress.toString();

        const existing = (await this._fetchBlob(sponsorAddress, LEADERBOARD_BLOB)) ?? [];
        const updated = this._mergeRecord(existing, newRecord);
        console.log(`[SHELBY] Uploading leaderboard.json (${updated.length} records)...`);
        await this._writeBlob(updated, LEADERBOARD_BLOB, sponsorSigner);
      } catch (shelbyErr) {
        console.warn("Shelby leaderboard upload failed — mint and local backup still succeeded:", shelbyErr);
      }

      // Sync the player's dynamic passport on Shelby
      await this.savePlayerPassport(this.walletAddress, credits, timeElapsed);

      return txHash;
    } catch (error) {
      console.error("Failed to submit score:", error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // FETCH LEADERBOARD — direct read (no indexer, no race)
  // ---------------------------------------------------------------------------

  static async fetchLeaderboard() {
    try {
      const sponsorSigner = this._getSponsorSigner();
      const sponsorAddress = sponsorSigner.accountAddress.toString();

      const records = await this._fetchBlob(sponsorAddress, LEADERBOARD_BLOB);
      if (!records) {
        console.log("[SHELBY] No leaderboard.json yet — empty leaderboard.");
        return this.mergeWithLocalBackup([]);
      }

      console.log(`[SHELBY] Loaded ${records.length} records from leaderboard.json.`);
      const sorted = [...records].sort(
        (a, b) => b.score - a.score || a.time_elapsed - b.time_elapsed
      );
      return this.mergeWithLocalBackup(sorted);
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      return this.mergeWithLocalBackup([]);
    }
  }

  // ---------------------------------------------------------------------------
  // LOCAL BACKUP MERGE
  // ---------------------------------------------------------------------------

  static mergeWithLocalBackup(liveRecords) {
    if (!this.walletAddress) return liveRecords;
    try {
      const raw = localStorage.getItem(`shelby_score_${this.walletAddress}`);
      if (!raw) return liveRecords;
      return this._mergeRecord(liveRecords, JSON.parse(raw));
    } catch (e) {
      console.warn("Failed to merge local backup:", e);
      return liveRecords;
    }
  }
}

export default ShelbyManager;