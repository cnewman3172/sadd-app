#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/push_to_github.sh <github-username> <repo-name>
#
# Requires:
#   - SSH key added to GitHub (public key)
#   - Private key provided via one of:
#       1) .env -> GITHUB_SSH_PRIVATE_KEY (multiline) or GITHUB_SSH_PRIVATE_KEY_B64
#       2) env var KEY_PATH
#       3) repo-local key at ops/keys/github_ed25519

if [ "${1:-}" = "" ] || [ "${2:-}" = "" ]; then
  echo "Usage: scripts/push_to_github.sh <github-username> <repo-name>" >&2
  exit 1
fi

GH_USER="$1"
REPO_NAME="$2"
URL="git@github.com:${GH_USER}/${REPO_NAME}.git"

# Load .env if present (exporting variables)
if [ -f ./.env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# Determine SSH key source
ensure_ssh_setup() {
  mkdir -p "$HOME/.ssh"
  chmod 700 "$HOME/.ssh"
  # Pre-populate known_hosts to avoid prompts
  if ! grep -q "github.com" "$HOME/.ssh/known_hosts" 2>/dev/null; then
    ssh-keyscan github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null || true
    chmod 644 "$HOME/.ssh/known_hosts" || true
  fi
}

use_key_from_env() {
  local key_file
  key_file="/tmp/github_key_$$"
  if [ -n "${GITHUB_SSH_PRIVATE_KEY_B64:-}" ]; then
    printf '%s' "$GITHUB_SSH_PRIVATE_KEY_B64" | base64 -d > "$key_file"
  elif [ -n "${GITHUB_SSH_PRIVATE_KEY:-}" ]; then
    printf '%s' "$GITHUB_SSH_PRIVATE_KEY" > "$key_file"
  else
    return 1
  fi
  chmod 600 "$key_file"
  export GIT_SSH_COMMAND="ssh -i \"$key_file\" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  echo "Using SSH key from environment (.env)"
  # Leave key file for this run; it is in /tmp and process-unique
  return 0
}

use_key_from_path() {
  local path="${KEY_PATH:-ops/keys/github_ed25519}"
  if [ -f "$path" ]; then
    chmod 600 "$path" 2>/dev/null || true
    export GIT_SSH_COMMAND="ssh -i \"$path\" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
    echo "Using SSH key at: $path"
    return 0
  fi
  return 1
}

ensure_ssh_setup
use_key_from_env || use_key_from_path || true

cd "$(dirname "$0")/.."

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" = "HEAD" ]; then
  echo "Detached HEAD; please checkout a branch (e.g., main)." >&2
  exit 1
fi

if git remote | grep -q '^github$'; then
  git remote set-url github "$URL"
else
  git remote add github "$URL"
fi

echo "Pushing branch '$current_branch' to $URL ..."
git push github "HEAD:main"

echo "Done. Repository pushed to GitHub: ${GH_USER}/${REPO_NAME}"
