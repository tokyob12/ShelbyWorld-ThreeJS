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

  // Lazily created — building the erasure coding provider (WASM) is expensive
  static _client = null;
  static _getClient() {
    if (!this._client) this._client = new ShelbyClient({ network: "shelbynet" });
    return this._client;
  }

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

  // Direct blob GET — only call this after confirming existence via getBlobMetadata.
  static async _fetchLeaderboardBlob(sponsorAddress) {
    const url = `${SHELBY_API}/${sponsorAddress}/${LEADERBOARD_BLOB}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch leaderboard.json: ${res.status}`);
    return res.json();
  }

  // Write records as leaderboard.json.
  //
  // Shelby blobs are IMMUTABLE — registration pins the merkle root + byte size
  // on-chain. Uploading different bytes under the same name skips re-registration
  // (SDK finds the existing on-chain entry) but the storage layer then rejects
  // the mismatched content at the multipart /complete step with HTTP 400.
  // The correct update pattern is: delete old registration → upload fresh.
  static async _uploadLeaderboardBlob(records, sponsorSigner) {
    const client = this._getClient();
    const account = sponsorSigner.accountAddress;

    // Check on-chain registration (indexer query — always 200, never a red 404)
    let exists = false;
    try {
      const meta = await client.coordination.getBlobMetadata({
        account,
        name: LEADERBOARD_BLOB,
      });
      exists = !!meta;
    } catch (_) {
      exists = false;
    }

    if (exists) {
      console.log("[SHELBY] Deleting old leaderboard.json registration...");
      const { transaction } = await client.coordination.deleteBlob({
        account: sponsorSigner,
        blobName: LEADERBOARD_BLOB,
      });
      await client.aptos.waitForTransaction({ transactionHash: transaction.hash });
    }

    const blobData = new TextEncoder().encode(JSON.stringify(records));
    const thirtyDaysInMicros = 86400 * 30 * 1_000_000;
    const expirationMicros = Date.now() * 1000 + thirtyDaysInMicros;

    await client.upload({
      blobData,
      signer: sponsorSigner,
      blobName: LEADERBOARD_BLOB,
      expirationMicros,
    });
  }

  // Merge newRecord into records keeping personal best per wallet.
  // Higher score wins; fastest time_elapsed breaks ties.
  // Returns a new array sorted: score desc, time_elapsed asc.
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

    const current = map.get(newRecord.wallet_address);
    if (
      !current ||
      newRecord.score > current.score ||
      (newRecord.score === current.score &&
        newRecord.time_elapsed < current.time_elapsed)
    ) {
      map.set(newRecord.wallet_address, newRecord);
    }

    return Array.from(map.values()).sort(
      (a, b) => b.score - a.score || a.time_elapsed - b.time_elapsed
    );
  }

  // ---------------------------------------------------------------------------
  // SUBMIT FINAL SCORE
  // ---------------------------------------------------------------------------

  static async submitFinalScore(credits, timeElapsed) {
    if (!this.isConnected || !this.activeWallet) {
      throw new Error("Wallet not connected");
    }

    try {
      // Step 1 — on-chain mint, signed by the player
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

      // Local fallback written first — score is safe even if Shelby upload fails
      try {
        localStorage.setItem(
          `shelby_score_${this.walletAddress}`,
          JSON.stringify(newRecord)
        );
      } catch (e) {
        console.warn("Local backup write failed:", e);
      }

      // Step 2 — read → merge → delete → rewrite leaderboard.json (sponsor pays)
      try {
        const sponsorSigner = this._getSponsorSigner();
        const sponsorAddress = sponsorSigner.accountAddress.toString();

        // Check existence on-chain before attempting a blob GET (avoids red 404)
        let existing = [];
        let existingMeta;
        try {
          existingMeta = await this._getClient().coordination.getBlobMetadata({
            account: sponsorSigner.accountAddress,
            name: LEADERBOARD_BLOB,
          });
        } catch (_) {
          existingMeta = undefined;
        }

        if (existingMeta) {
          console.log("[SHELBY] Fetching current leaderboard.json...");
          existing = await this._fetchLeaderboardBlob(sponsorAddress);
        } else {
          console.log("[SHELBY] No leaderboard.json yet — starting fresh.");
        }

        const updated = this._mergeRecord(existing, newRecord);
        console.log(`[SHELBY] Uploading leaderboard.json (${updated.length} records)...`);
        await this._uploadLeaderboardBlob(updated, sponsorSigner);
        console.log(
          `[SHELBY] ✅ leaderboard.json updated → ${SHELBY_API}/${sponsorAddress}/${LEADERBOARD_BLOB}`
        );
      } catch (shelbyErr) {
        console.warn(
          "Shelby upload failed — on-chain mint and local backup still succeeded:",
          shelbyErr
        );
      }

      return txHash;
    } catch (error) {
      console.error("Failed to submit score:", error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // FETCH LEADERBOARD — 1 request, zero red 404s
  // ---------------------------------------------------------------------------

  static async fetchLeaderboard() {
    try {
      const sponsorSigner = this._getSponsorSigner();
      const sponsorAddress = sponsorSigner.accountAddress.toString();

      // Check on-chain first (indexer, always 200). Only do the blob GET when
      // the file is confirmed to exist — browser cannot suppress red 404s from
      // fetch() calls even when the promise is caught.
      let meta;
      try {
        meta = await this._getClient().coordination.getBlobMetadata({
          account: sponsorSigner.accountAddress,
          name: LEADERBOARD_BLOB,
        });
      } catch (_) {
        meta = undefined;
      }

      if (!meta) {
        console.log("[SHELBY] No leaderboard.json on-chain yet — empty leaderboard.");
        return this.mergeWithLocalBackup([]);
      }

      console.log("[SHELBY] Fetching leaderboard.json...");
      const records = await this._fetchLeaderboardBlob(sponsorAddress);
      console.log(`[SHELBY] Loaded ${records.length} records.`);

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
      const local = JSON.parse(raw);
      return this._mergeRecord(liveRecords, local);
    } catch (e) {
      console.warn("Failed to merge local backup:", e);
      return liveRecords;
    }
  }
}

export default ShelbyManager;