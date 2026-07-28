#!/usr/bin/env bash
# Re-upload game GLBs to Shelby using the current CLI contract:
#   shelby upload [options] <src> <dst>
#   --expiration (-e) is REQUIRED
# Docs: https://docs.shelby.xyz/tools/cli/commands/uploads
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_DIR="$ROOT/public/model"
# Human-readable expiration accepted by the CLI (or use a UNIX epoch)
EXPIRATION="${SHELBY_EXPIRATION:-2027-12-31}"

FILES=(
  "Meebit.glb:model/Meebit.glb"
  "test333.glb:model/test333.glb"
  "key.glb:model/key.glb"
  "logo.glb:model/logo.glb"
)

echo "Uploading models from $MODEL_DIR (expiration: $EXPIRATION)"
echo "Active CLI context/account: use \`shelby context list\` / \`shelby account list\`"

for entry in "${FILES[@]}"; do
  src="${entry%%:*}"
  dst="${entry##*:}"
  if [[ ! -f "$MODEL_DIR/$src" ]]; then
    echo "skip missing: $MODEL_DIR/$src"
    continue
  fi
  echo "→ $src  =>  $dst"
  # Delete first if the blob name already exists (blobs are immutable)
  shelby delete "$dst" --assume-yes 2>/dev/null || true
  shelby upload "$MODEL_DIR/$src" "$dst" \
    --expiration "$EXPIRATION" \
    --assume-yes
done

echo "Done. Blob URLs use account address + blob name under /shelby/v1/blobs/..."
