#!/usr/bin/env bash
# Build build-assets/icon.icns from the generated 1024 master (macOS only).
set -euo pipefail
cd "$(dirname "$0")/.."

node scripts/generate-app-icon.mjs

MASTER="build-assets/icon-1024.png"
SET="build-assets/icon.iconset"
rm -rf "$SET"; mkdir -p "$SET"

# Apple-required iconset sizes (base + @2x).
sips -z 16 16     "$MASTER" --out "$SET/icon_16x16.png"      >/dev/null
sips -z 32 32     "$MASTER" --out "$SET/icon_16x16@2x.png"   >/dev/null
sips -z 32 32     "$MASTER" --out "$SET/icon_32x32.png"      >/dev/null
sips -z 64 64     "$MASTER" --out "$SET/icon_32x32@2x.png"   >/dev/null
sips -z 128 128   "$MASTER" --out "$SET/icon_128x128.png"    >/dev/null
sips -z 256 256   "$MASTER" --out "$SET/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$MASTER" --out "$SET/icon_256x256.png"    >/dev/null
sips -z 512 512   "$MASTER" --out "$SET/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$MASTER" --out "$SET/icon_512x512.png"    >/dev/null
cp "$MASTER" "$SET/icon_512x512@2x.png"

iconutil -c icns "$SET" -o build-assets/icon.icns
rm -rf "$SET"
echo "Wrote build-assets/icon.icns"
