#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/push_to_github.sh <github-username> <repo-name>
#
# Requires:
#   - SSH key added to GitHub (see ~/.ssh/id_ed25519_github.pub)
#   - SSH config set for github.com (done by the assistant)

if [ "${1:-}" = "" ] || [ "${2:-}" = "" ]; then
  echo "Usage: scripts/push_to_github.sh <github-username> <repo-name>" >&2
  exit 1
fi

GH_USER="$1"
REPO_NAME="$2"
URL="git@github.com:${GH_USER}/${REPO_NAME}.git"

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

