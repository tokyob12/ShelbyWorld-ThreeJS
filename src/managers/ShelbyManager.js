import { getAptosWallets } from "@aptos-labs/wallet-standard";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const SHELBY_API = "https://api.shelbynet.shelby.xyz/shelby/v1/blobs";
const LEADERBOARD_BLOB = "leaderboard.json";

export class ShelbyManager {
  static walletAddress = null;
  static isConnected = false;
  static activeWallet = null;

  static SHELBY_MODULE_ADDRESS = "0x684a223128e42522169840148c8e70e46c785ca15f4582b89ca9118a7af28b53::game_protocol";
  static SPONSOR_PRIVATE_KEY_HEX = import.meta.env.VITE_SPONSOR_PRIVATE_KEY;

  static _client = null;
  static _passportCache = new Map();

  static _getClient() {
    if (!this._client) this._client = new ShelbyClient({ network: "shelbynet" });
    return this._client;
  }

  // -------------------------------------------------------------------------
  // WALLET CONNECTION
  // -------------------------------------------------------------------------

  static async getStandardWallet() {
    const { aptosWallets, on } = getAptosWallets();

    const getPreferred = (wallets) => {
      const petra = wallets.find(w => w.name.includes("Petra"));
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
      const rawAddress = response.args?.address || response.account?.address || response.address;
      if (!rawAddress) throw new Error("Failed to retrieve wallet address.");

      this.walletAddress = typeof rawAddress === "string" ? rawAddress : rawAddress.toString();
      this.activeWallet = wallet;
      this.isConnected = true;

      const shortAddress = `${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(this.walletAddress.length - 4)}`;
      return { address: this.walletAddress, shortAddress };
    } catch (error) {
      console.error("Wallet connection failed:", error);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // INTERNAL HELPERS
  // -------------------------------------------------------------------------

  static _getSponsorSigner() {
    if (!this.SPONSOR_PRIVATE_KEY_HEX) {
      throw new Error("Sponsor private key not configured.");
    }
    const pKey = new Ed25519PrivateKey(this.SPONSOR_PRIVATE_KEY_HEX);
    return Account.fromPrivateKey({ privateKey: pKey });
  }

  // Retry wrapper — backs off on HTTP 429 (rate limit): 1s, 2s, 4s, 8s
  static async _retryWithBackoff(fn, maxAttempts = 4) {
    let delay = 1000;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const is429 = err?.message?.includes("429") || err?.status === 429 || err?.response?.status === 429;
        if (!is429 || attempt === maxAttempts) throw err;
        console.warn(`[SHELBY] 429 rate limit — retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      }
    }
  }

  // On-chain view — always HTTP 200, no red 404 in console
  static async _blobExists(account, name) {
    try {
      const meta = await this._retryWithBackoff(() =>
        this._getClient().coordination.getBlobMetadata({ account, name })
      );
      return !!meta;
    } catch (_) {
      return false;
    }
  }

  // Direct storage read — returns null on 404, throws on other errors
  static async _fetchBlob(sponsorAddress, blobName) {
    const url = `${SHELBY_API}/${sponsorAddress}/${blobName}`;
    const res = await fetch(url);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Failed to fetch ${blobName}: ${res.status}`);
    return res.json();
  }

  // Delete the old registration, then upload fresh bytes (Shelby blobs are immutable)
  static async _writeBlob(data, blobName, sponsorSigner) {
    const client = this._getClient();
    let existsMeta = null;
    try {
      existsMeta = await this._retryWithBackoff(() =>
        client.coordination.getBlobMetadata({
          account: sponsorSigner.accountAddress,
          name: blobName,
        })
      );
    } catch (_) {}

    if (existsMeta) {
      console.log(`[SHELBY] ${blobName} exists — deleting before rewrite...`);
      const { transaction } = await client.coordination.deleteBlob({
        account: sponsorSigner,
        blobName,
      });
      await client.aptos.waitForTransaction({ transactionHash: transaction.hash });
      // Brief pause so the RPC node catches up before upload's internal metadata check
      await new Promise((r) => setTimeout(r, 1500));
    }

    const blobData = new TextEncoder().encode(JSON.stringify(data));
    const expirationMicros = Date.now() * 1000 + 86400 * 30 * 1_000_000;
    await this._retryWithBackoff(() =>
      client.upload({ blobData, signer: sponsorSigner, blobName, expirationMicros })
    );
  }

  static _mergeRecord(records, newRecord) {
    const map = new Map();
    for (const r of records) {
      if (!r.wallet_address) continue;
      const existing = map.get(r.wallet_address);
      if (
        !existing ||
        r.score > existing.score ||
        (r.score === existing.score && r.time_elapsed < existing.time_elapsed)
      ) {
        map.set(r.wallet_address, r);
      }
    }
    const wallet = newRecord.wallet_address;
    const current = map.get(wallet);
    if (
      !current ||
      newRecord.score > current.score ||
      (newRecord.score === current.score && newRecord.time_elapsed < current.time_elapsed)
    ) {
      map.set(wallet, newRecord);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.score - a.score || a.time_elapsed - b.time_elapsed
    );
  }

  // -------------------------------------------------------------------------
  // SUBMIT FINAL SCORE
  // -------------------------------------------------------------------------

  static async submitFinalScore(credits, timeElapsed, frames = []) {
    if (!this.isConnected || !this.activeWallet) {
      throw new Error("Wallet not connected");
    }

    try {
      // 1. ON-CHAIN MINT (signed by player)
      const txFeature = this.activeWallet.features["aptos:signAndSubmitTransaction"];
      if (!txFeature) throw new Error("Wallet does not support transaction signing.");

      const response = await txFeature.signAndSubmitTransaction({
        payload: {
          function: `${this.SHELBY_MODULE_ADDRESS}::mint_passport`,
          typeArguments: [],
          functionArguments: [credits.toString()],
        },
      });

      const txHash = response.hash || response.transaction?.hash || response.args?.hash || response.id;
      if (!txHash) throw new Error("Failed to capture a valid transaction hash.");

      console.log("✅ On-chain Mint Tx:", txHash);

      const newRecord = {
        wallet_address: this.walletAddress,
        score: credits,
        time_elapsed: timeElapsed,
        tx_hash: txHash,
        timestamp: Date.now(),
      };

      // Local backup — written first so no score is ever lost
      try {
        localStorage.setItem(`shelby_score_${this.walletAddress}`, JSON.stringify(newRecord));
      } catch (e) {
        console.warn("Local backup write failed:", e);
      }

      // 2. LEADERBOARD BLOB UPDATE
      try {
        const sponsorSigner = this._getSponsorSigner();
        const sponsorAddress = sponsorSigner.accountAddress.toString();
        console.log("📥 [SHELBY] Fetching current leaderboard.json...");
        const existing = await this._fetchBlob(sponsorAddress, LEADERBOARD_BLOB) || [];
        const updated = this._mergeRecord(existing, newRecord);
        console.log(`📤 [SHELBY] Uploading leaderboard.json (${updated.length} records)...`);
        await this._writeBlob(updated, LEADERBOARD_BLOB, sponsorSigner);
        console.log("✅ [SHELBY] leaderboard.json updated.");
      } catch (shelbyErr) {
        console.warn("Shelby leaderboard upload failed:", shelbyErr);
      }

      // Brief pause between Shelby operations to avoid rate limit
      await new Promise((r) => setTimeout(r, 1000));

      // 3. GHOST REPLAY BLOB UPLOAD
      if (frames.length > 1) {
        try {
          await this.saveReplay(this.walletAddress, frames);
        } catch (replayErr) {
          console.warn("Ghost replay upload failed (score still saved):", replayErr);
        }
      }

      // Brief pause between Shelby operations to avoid rate limit
      await new Promise((r) => setTimeout(r, 1000));

      // 4. DYNAMIC PASSPORT UPDATE
      try {
        await this.savePlayerPassport(this.walletAddress, credits, timeElapsed);
      } catch (passportErr) {
        console.warn("Passport update failed (score still saved):", passportErr);
      }

      return txHash;
    } catch (error) {
      console.error("Failed to submit score:", error);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // GHOST REPLAY
  // -------------------------------------------------------------------------

  static async saveReplay(walletAddress, frames) {
    const sponsorSigner = this._getSponsorSigner();
    const blobName = `${walletAddress}_replay.json`;
    const data = { wallet_address: walletAddress, frames };
    console.log(`📤 [SHELBY] Uploading ghost replay (${frames.length} frames)...`);
    await this._writeBlob(data, blobName, sponsorSigner);
    console.log("✅ [SHELBY] Ghost replay saved.");
  }

  static async fetchReplay(walletAddress) {
    try {
      const sponsorSigner = this._getSponsorSigner();
      const sponsorAddress = sponsorSigner.accountAddress.toString();
      const blobName = `${walletAddress}_replay.json`;

      // Check existence first — avoids a red 404 for players who never submitted a replay
      const exists = await this._blobExists(sponsorSigner.accountAddress, blobName);
      if (!exists) {
        console.log(`[SHELBY] No replay found for ${walletAddress}`);
        return null;
      }

      console.log(`🔍 [SHELBY] Fetching replay for ${walletAddress}...`);
      return await this._fetchBlob(sponsorAddress, blobName);
    } catch (error) {
      console.warn("fetchReplay failed:", error);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // DYNAMIC NFT PASSPORT
  // -------------------------------------------------------------------------

  static _attr(passport, traitType) {
    return passport?.attributes?.find(a => a.trait_type === traitType)?.value;
  }

  static async fetchPlayerPassport(walletAddress) {
    // Check session cache first — instant and avoids repeat network reads
    if (this._passportCache.has(walletAddress)) {
      return this._passportCache.get(walletAddress);
    }

    try {
      const sponsorSigner = this._getSponsorSigner();
      const blobName = `${walletAddress}_passport.json`;

      // On-chain view — always HTTP 200, no red 404 for first-time players
      const exists = await this._blobExists(sponsorSigner.accountAddress, blobName);
      if (!exists) {
        this._passportCache.set(walletAddress, null);
        return null;
      }

      const sponsorAddress = sponsorSigner.accountAddress.toString();
      const passport = await this._fetchBlob(sponsorAddress, blobName);
      this._passportCache.set(walletAddress, passport);
      return passport;
    } catch (e) {
      console.warn("fetchPlayerPassport failed:", e);
      return null;
    }
  }

  static async savePlayerPassport(walletAddress, credits, timeElapsed) {
    try {
      const sponsorSigner = this._getSponsorSigner();
      const blobName = `${walletAddress}_passport.json`;

      // Load existing passport (cache hit if already read this session)
      const existing = await this.fetchPlayerPassport(walletAddress);

      const prevBestScore = this._attr(existing, "Best Score");
      const prevBestTime = this._attr(existing, "Best Time (s)");
      const prevRuns = this._attr(existing, "Total Runs") || 0;

      const isNewPB =
        prevBestScore == null ||
        credits > prevBestScore ||
        (credits === prevBestScore && timeElapsed < prevBestTime);

      const bestScore = isNewPB ? credits : prevBestScore;
      const bestTime = isNewPB ? timeElapsed : prevBestTime;

      const passport = {
        name: `ShelbyWorld Passport — ${walletAddress.substring(0, 8)}`,
        description: "Verifiable on-chain run record for ShelbyWorld Quest, stored on Shelby decentralized storage.",
        external_url: "https://shelbyworld.xyz",
        attributes: [
          { trait_type: "Best Score", value: bestScore },
          { trait_type: "Best Time (s)", value: bestTime },
          { trait_type: "Total Runs", value: prevRuns + 1 },
          { trait_type: "Last Score", value: credits },
          { trait_type: "Outpost Status", value: "CLEARED" },
          { trait_type: "Last Updated", value: new Date().toISOString() },
        ],
      };

      await this._writeBlob(passport, blobName, sponsorSigner);

      // Update cache so the badge refreshes instantly
      this._passportCache.set(walletAddress, passport);
      console.log("✅ [SHELBY] Passport updated for", walletAddress);

      return passport;
    } catch (e) {
      console.warn("savePlayerPassport failed:", e);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // FETCH LEADERBOARD
  // -------------------------------------------------------------------------

  static async fetchLeaderboard() {
    try {
      const sponsorSigner = this._getSponsorSigner();
      const sponsorAddress = sponsorSigner.accountAddress.toString();

      const records = await this._fetchBlob(sponsorAddress, LEADERBOARD_BLOB);
      if (!records) {
        console.log("[SHELBY] No leaderboard.json yet — starting empty.");
        return this.mergeWithLocalBackup([]);
      }

      console.log(`📦 [SHELBY] Loaded ${records.length} records.`);
      const sorted = [...records].sort(
        (a, b) => b.score - a.score || a.time_elapsed - b.time_elapsed
      );
      return this.mergeWithLocalBackup(sorted);
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      return this.mergeWithLocalBackup([]);
    }
  }

  // -------------------------------------------------------------------------
  // LOCAL BACKUP MERGE
  // -------------------------------------------------------------------------

  static mergeWithLocalBackup(liveRecords) {
    if (!this.walletAddress) return liveRecords;
    try {
      const raw = localStorage.getItem(`shelby_score_${this.walletAddress}`);
      if (!raw) return liveRecords;
      const local = JSON.parse(raw);
      return this._mergeRecord(liveRecords, local);
    } catch (e) {
      console.warn("Failed to merge local backup:", e);
      return liveRecords;
    }
  }
}

export default ShelbyManager;