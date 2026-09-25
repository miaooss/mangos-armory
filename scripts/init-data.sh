#!/bin/sh
set -e

DATA_DIR="/data"
SENTINEL="$DATA_DIR/Achievement_3.3.5_12340.csv"
TEMP_DIR="$DATA_DIR/.tmp-download"

RELEASE_URL="${INIT_DATA_RELEASE_URL}"
GITHUB_API="${INIT_DATA_GITHUB_API}"
RAW_BASE="${INIT_DATA_RAW_BASE}"

if [ -z "$RELEASE_URL" ] || [ -z "$GITHUB_API" ] || [ -z "$RAW_BASE" ]; then
    echo "[init-data] ERROR: INIT_DATA_RELEASE_URL, INIT_DATA_GITHUB_API and INIT_DATA_RAW_BASE must be set."
    exit 1
fi

apk add --no-cache curl jq > /dev/null 2>&1

# ── Step 1: CSV / DBC files ────────────────────────────────────────────────────
if [ ! -f "$SENTINEL" ]; then
    echo "[init-data] Listing CSV files from GitHub..."
    CSV_FILES=$(curl -fsSL "$GITHUB_API" | jq -r '.[] | select(.name | endswith(".csv")) | .name')

    echo "[init-data] Downloading DBC CSV files..."
    for f in $CSV_FILES; do
        echo "  -> $f"
        curl -fsSL --retry 3 "$RAW_BASE/$f" -o "$DATA_DIR/$f"
    done
    echo "[init-data] CSV files downloaded."
else
    echo "[init-data] CSV files already present, skipping."
fi

# ── Step 2: Model viewer assets ────────────────────────────────────────────────
if [ -d "$DATA_DIR/meta" ] && [ -d "$DATA_DIR/mo3" ]; then
    echo "[init-data] Model viewer data already present, skipping."
    exit 0
fi

echo "[init-data] Downloading model viewer data from GitHub release (~2 GB, this may take a while)..."
mkdir -p "$TEMP_DIR"
curl -L --retry 5 --retry-delay 10 --retry-connrefused \
    --progress-bar \
    -o "$TEMP_DIR/data.tar.gz" \
    "$RELEASE_URL"

echo "[init-data] Extracting..."
tar -xzf "$TEMP_DIR/data.tar.gz" -C "$DATA_DIR"

rm -rf "$TEMP_DIR"

echo "[init-data] Done."
