#!/bin/bash
# install-cli.command — install the `chiikawa` CLI launcher from the DMG.
#
# This copies the bundled launcher script to /usr/local/bin/chiikawa so you can
# start OhMyChiikawa from Terminal with:
#
#   chiikawa
#   chiikawa --size small
#   chiikawa --pet usagi
#
# The script needs no dependencies beyond Node.js 18+ and an Electron installation
# alongside it. Run this once after installing the app.

set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BIN_DIR="/usr/local/bin"
LINK="${BIN_DIR}/chiikawa"

if [ ! -f "${APP_DIR}/chiikawa.js" ]; then
  echo "ERROR: Cannot find chiikawa.js next to OhMyChiikawa.app."
  echo "Please make sure you run this script from inside the DMG, or from"
  echo "inside the installed OhMyChiikawa.app/Contents/Resources/ directory."
  exit 1
fi

if [ ! -w "${BIN_DIR}" ]; then
  echo "Need write permission to ${BIN_DIR} — requesting sudo..."
  sudo mkdir -p "${BIN_DIR}"
  sudo rm -f "${LINK}"
  sudo ln -s "${APP_DIR}/chiikawa.js" "${LINK}"
  sudo chmod +x "${LINK}"
else
  mkdir -p "${BIN_DIR}"
  rm -f "${LINK}"
  ln -s "${APP_DIR}/chiikawa.js" "${LINK}"
  chmod +x "${LINK}"
fi

echo "✔ CLI installed! You can now run: chiikawa"
echo "  chiikawa --help    show all options"
echo "  chiikawa start     launch the pet"
echo "  chiikawa --size large"
echo ""
echo "If 'chiikawa' is not found, add /usr/local/bin to your PATH, or open"
echo "a new Terminal window."
