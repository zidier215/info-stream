#!/bin/bash
set -e

# Navigate to script directory
cd "$(dirname "$0")"
export PATH="/c/Program Files/nodejs:/mnt/c/Program Files/nodejs:$PATH"

TMP_BIN="/tmp/node_bin_$$"
mkdir -p "$TMP_BIN"
if ! command -v node >/dev/null 2>&1; then
  if [ -f "/mnt/c/Program Files/nodejs/node.exe" ]; then
    printf '#!/bin/sh\nexec "/mnt/c/Program Files/nodejs/node.exe" "$@"\n' > "$TMP_BIN/node"
  elif [ -f "/c/Program Files/nodejs/node.exe" ]; then
    printf '#!/bin/sh\nexec "/c/Program Files/nodejs/node.exe" "$@"\n' > "$TMP_BIN/node"
  fi
  chmod +x "$TMP_BIN/node"
  export PATH="$TMP_BIN:$PATH"
fi

# Run build & deploy
echo "=== Starting build & deploy for info-stream ==="
node prefetch.mjs
node build.mjs

if [ -f "d:/techminds-site/node_modules/wrangler/bin/wrangler.js" ]; then
  WRANGLER="node d:/techminds-site/node_modules/wrangler/bin/wrangler.js"
elif [ -f "/d/techminds-site/node_modules/wrangler/bin/wrangler.js" ]; then
  WRANGLER="node /d/techminds-site/node_modules/wrangler/bin/wrangler.js"
elif [ -f "/mnt/d/techminds-site/node_modules/wrangler/bin/wrangler.js" ]; then
  WRANGLER="node d:/techminds-site/node_modules/wrangler/bin/wrangler.js"
elif command -v wrangler >/dev/null 2>&1; then
  WRANGLER="wrangler"
else
  WRANGLER="npx wrangler"
fi

if [ -f ".env.local" ]; then
  set -a
  . ./.env.local
  set +a
fi
export WSLENV="CLOUDFLARE_API_TOKEN:CLOUDFLARE_ACCOUNT_ID:$WSLENV"
$WRANGLER pages deploy public --project-name info-stream --branch main --commit-dirty=true

# Optional: Run Live Audit if requested (--audit flag or AUDIT=1)
if [ "$1" = "--audit" ] || [ "$2" = "--audit" ] || [ "$AUDIT" = "1" ]; then
  if [ -f "live_audit.mjs" ]; then
    echo "=== Running post-deploy live HTTP audit ==="
    node live_audit.mjs
  fi
fi

# Optional: Git Push if requested (--push flag)
if [ "$1" = "--push" ] || [ "$2" = "--push" ]; then
  echo "=== Pushing git commits ==="
  git -c http.proxy= -c https.proxy= push || echo "Git push skipped or failed"
fi

echo "=== Deployment completed ==="