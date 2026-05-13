#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUIRED_NODE_MAJOR="${NODE_REQUIRED_MAJOR:-24}"

current_node_major=""
if command -v node >/dev/null 2>&1; then
  current_node_major="$(node -p "process.versions.node.split('.')[0]")"
fi

if [[ "$current_node_major" != "$REQUIRED_NODE_MAJOR" ]]; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    if nvm use "$REQUIRED_NODE_MAJOR" >/dev/null 2>&1; then
      exec node "$SCRIPT_DIR/release-macos.mjs"
    fi
  fi
fi

exec node "$SCRIPT_DIR/release-macos.mjs"
