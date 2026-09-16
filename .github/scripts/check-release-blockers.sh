#!/usr/bin/env bash

set -euo pipefail

blocker_url="$(gh issue list \
  --repo "$GITHUB_REPOSITORY" \
  --state open \
  --label release-blocker \
  --limit 1 \
  --json url \
  --jq '.[0].url // empty')"

if [[ -n "$blocker_url" ]]; then
  echo "::error::Release blocked by $blocker_url"
  exit 1
fi

echo "No open release blockers."
