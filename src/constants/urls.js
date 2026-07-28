import { Network } from "@aptos-labs/ts-sdk";
import { NetworkToShelbyRPCBaseUrl } from "@shelby-protocol/sdk/browser";

// Asset owner account (Shelby CLI default account `arash2`)
export const SHELBY_ASSET_ACCOUNT =
  "0x236f14622de45f2f2246df2a0736d6ccbbbbbd23e4c7570ad3378cfdfaa589d5";

// Keep shelbynet unless you migrate assets + CLI context to Aptos testnet
const SHELBY_NETWORK =
  import.meta.env.VITE_SHELBY_NETWORK === "testnet"
    ? Network.TESTNET
    : Network.SHELBYNET;

const SHELBY_RPC =
  NetworkToShelbyRPCBaseUrl[SHELBY_NETWORK] ??
  NetworkToShelbyRPCBaseUrl[Network.SHELBYNET];

const blobUrl = (name) =>
  `${SHELBY_RPC}/v1/blobs/${SHELBY_ASSET_ACCOUNT}/${name}`;

export const SHELBY_URLS = {
  // Remote streams on Shelby RPC gateway (re-upload with: shelby upload <src> <dst> -e <expiration>)
  meebit: blobUrl("model/Meebit.glb"),
  environment: blobUrl("model/test333.glb"),
  key: blobUrl("model/key.glb"),
  crateAndKey: blobUrl("model/logo.glb"),
};
