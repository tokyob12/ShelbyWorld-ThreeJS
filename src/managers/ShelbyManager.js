import { getAptosWallets } from "@aptos-labs/wallet-standard";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";
import { Network, Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

export class ShelbyManager {
  static walletAddress = null;
  static isConnected = false;
  static activeWallet = null; 

  static SHELBY_MODULE_ADDRESS = "0x684a223128e42522169840148c8e70e46c785ca15f4582b89ca9118a7af28b53::game_protocol"; 

  static SPONSOR_PRIVATE_KEY_HEX = "0xfbfc29690378b7bc5465b6a1266b29fdd0cad279e9bf047b4d0bb933ef8103d0"; 

  static async getStandardWallet() {
    const { aptosWallets, on } = getAptosWallets();
    
    const getPreferredWallet = (wallets) => {
      const petra = wallets.find(w => w.name.includes("Petra"));
      return petra || (wallets.length > 0 ? wallets[0] : null);
    };

    let wallet = getPreferredWallet(aptosWallets);
    if (wallet) return wallet;

    return new Promise((resolve) => {
      let isResolved = false;
      const removeListener = on("register", () => {
        const { aptosWallets: updatedWallets } = getAptosWallets();
        wallet = getPreferredWallet(updatedWallets);
        if (wallet && !isResolved) {
          isResolved = true;
          removeListener();
          resolve(wallet);
        }
      });

      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          removeListener();
          const { finalWallets } = getAptosWallets();
          resolve(getPreferredWallet(finalWallets) || null);
        }
      }, 1000);
    });
  }

  static async connectWallet() {
    try {
      const wallet = await this.getStandardWallet();

      if (!wallet) {
        throw new Error("Aptos Wallet not found. Please install Petra.");
      }

      const connectFeature = wallet.features["aptos:connect"];
      if (!connectFeature) {
        throw new Error("Wallet does not support AIP-62 standard.");
      }

      const response = await connectFeature.connect();
      const rawAddress = response.args?.address || response.account?.address || response.address;
      
      if (!rawAddress) throw new Error("Failed to retrieve wallet address.");

      this.walletAddress = typeof rawAddress === 'string' ? rawAddress : rawAddress.toString();
      this.activeWallet = wallet; 
      this.isConnected = true;

      const shortAddress = `${this.walletAddress.substring(0, 6)}...${this.walletAddress.substring(this.walletAddress.length - 4)}`;
      return { address: this.walletAddress, shortAddress };
    } catch (error) {
      console.error("Wallet connection failed:", error);
      throw error;
    }
  }

  static async submitFinalScore(credits, timeElapsed) {
    if (!this.isConnected || !this.activeWallet) {
      throw new Error("Wallet not connected");
    }

    try {
      // 1. EXECUTE ON-CHAIN MINTING TRANSACTION
      const transactionFeature = this.activeWallet.features["aptos:signAndSubmitTransaction"];
      if (!transactionFeature) {
        throw new Error("Wallet does not support transaction signing.");
      }

      const payload = {
        function: `${this.SHELBY_MODULE_ADDRESS}::mint_passport`,
        typeArguments: [],
        functionArguments: [credits.toString()]
      };

      const response = await transactionFeature.signAndSubmitTransaction({ payload });
      const txHash = response.hash || response.transaction?.hash || response.args?.hash || response.id;
      
      if (!txHash) {
        throw new Error("Failed to capture a valid transaction hash.");
      }

      console.log("On-chain Mint Tx Hash:", txHash);

      // Save player score locally as a high-reliability fallback
      const localRecord = {
        wallet_address: this.walletAddress,
        score: credits,
        time_elapsed: timeElapsed,
        tx_hash: txHash,
        timestamp: Date.now()
      };
      try {
        localStorage.setItem(`shelby_score_${this.walletAddress}`, JSON.stringify(localRecord));
      } catch (localErr) {
        console.warn("Failed to write local backup score:", localErr);
      }

      // 2. ARCHIVE TO SHELBY VIA SEQUENTIAL LOG PROTOCOL
      try {
        const shelbyClient = new ShelbyClient({ network: "shelbynet" });
        const pKey = new Ed25519PrivateKey(this.SPONSOR_PRIVATE_KEY_HEX);
        const sponsorSigner = Account.fromPrivateKey({ privateKey: pKey });
        const sponsorAddress = sponsorSigner.accountAddress.toString();

        // Sequential search loop: locate the first unoccupied index slot on the network
        let nextIndex = 0;
        let slotFound = false;

        while (!slotFound && nextIndex < 100) { // Limit to 100 safety cap
          const checkUrl = `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${sponsorAddress}/Shelby_score_${nextIndex}.json`;
          const res = await fetch(checkUrl);
          if (res.status === 404) {
            slotFound = true; // Found an empty slot
          } else {
            nextIndex++;
          }
        }

        const sequentialBlobName = `Shelby_score_${nextIndex}.json`;
        console.log(`📤 [SHELBY INDEXER] Next available slot found: ${sequentialBlobName}`);

        const textEncoder = new TextEncoder();
        const blobData = textEncoder.encode(JSON.stringify(localRecord));

        await shelbyClient.upload({
          blobData,
          signer: sponsorSigner, 
          blobName: sequentialBlobName,
          expirationMicros: Date.now() * 1000 + (86400 * 365 * 1000000)
        });

        console.log("✅ [SHELBY SUCCESS] Player session data successfully stored on Shelby Storage!");
        const retrievalUrl = `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${sponsorAddress}/${sequentialBlobName}`;
        console.log(`🔗 [SHELBY URI] Stored JSON retrieval endpoint:\n👉 ${retrievalUrl}`);

      } catch (shelbyErr) {
        console.warn("Shelby Storage backup upload failed, but the on-chain mint and local backup succeeded:", shelbyErr);
      }
      
      return txHash; 
    } catch (error) {
      console.error("Failed to submit score:", error);
      throw error;
    }
  }

  static async fetchLeaderboard() {
    try {
      const pKey = new Ed25519PrivateKey(this.SPONSOR_PRIVATE_KEY_HEX);
      const sponsorSigner = Account.fromPrivateKey({ privateKey: pKey });
      const sponsorAddress = sponsorSigner.accountAddress.toString();
      
      const liveRecords = [];
      let currentIndex = 0;
      let endOfList = false;

      console.log("🔍 [SHELBY LEADERBOARD] Fetching sequential player logs...");

      // Download sequential logs until we hit the first 404 (representing the end of the folder)
      while (!endOfList && currentIndex < 100) {
        const fileUrl = `https://api.shelbynet.shelby.xyz/shelby/v1/blobs/${sponsorAddress}/Shelby_score_${currentIndex}.json`;
        try {
          const res = await fetch(fileUrl);
          if (res.ok) {
            const data = await res.json();
            liveRecords.push(data);
            currentIndex++;
          } else if (res.status === 404) {
            endOfList = true; // Stop loop immediately on first missing file
          } else {
            currentIndex++; // Skip on unhandled errors
          }
        } catch (err) {
          endOfList = true; // Fail safe on network disconnect
        }
      }

      console.log(`📦 [SHELBY LEADERBOARD] Loaded ${liveRecords.length} unique player session files.`);

      // ===================================================================
      // PERSONAL BEST DEDUPLICATION REDUCER
      // Groups all sessions by wallet address and preserves only their
      // single highest score (and fastest speedrun time for score ties).
      // ===================================================================
      const bestRecordsMap = new Map();
      liveRecords.forEach((record) => {
        const wallet = record.wallet_address;
        const existing = bestRecordsMap.get(wallet);
        
        if (!existing) {
          bestRecordsMap.set(wallet, record);
        } else {
          if (record.score > existing.score) {
            bestRecordsMap.set(wallet, record);
          } else if (record.score === existing.score && record.time_elapsed < existing.time_elapsed) {
            bestRecordsMap.set(wallet, record);
          }
        }
      });
      
      const finalRecords = Array.from(bestRecordsMap.values());
      return this.mergeWithLocalBackup(finalRecords);
    } catch (error) {
      console.error("Failed to load Shelby Leaderboard:", error);
      return this.mergeWithLocalBackup([]); 
    }
  }

  static mergeWithLocalBackup(liveRecords) {
    if (this.walletAddress) {
      try {
        const localData = localStorage.getItem(`shelby_score_${this.walletAddress}`);
        if (localData) {
          const localRecord = JSON.parse(localData);
          const existingIdx = liveRecords.findIndex(r => r.wallet_address === this.walletAddress);
          
          if (existingIdx === -1) {
            liveRecords.push(localRecord);
          } else {
            const existing = liveRecords[existingIdx];
            if (localRecord.score > existing.score || (localRecord.score === existing.score && localRecord.time_elapsed < existing.time_elapsed)) {
              liveRecords[existingIdx] = localRecord;
            }
          }
        }
      } catch (localErr) {
        console.warn("Failed to check local backup scores:", localErr);
      }
    }
    return liveRecords;
  }
}

// Double compatibility export
export default ShelbyManager;