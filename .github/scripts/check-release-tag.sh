#!/usr/bin/env bash

set -euo pipefail

mode=${1:?Usage: check-release-tag.sh MODE TAG EXPECTED_SHA}
tag=${2:?Usage: check-release-tag.sh MODE TAG EXPECTED_SHA}
expected_sha=${3:?Usage: check-release-tag.sh MODE TAG EXPECTED_SHA}

case "$mode" in
  optional | create | required) ;;
  *)
    echo "::error::Unknown release tag check mode: $mode"
    exit 1
    ;;
esac

resolve_remote_tag() {
  local direct_sha=
  local peeled_sha=
  local remote_refs
  local sha
  local ref

  if ! remote_refs=$(git ls-remote \
    origin \
    "refs/tags/$tag" \
    "refs/tags/$tag^{}"); then
    echo "::error::Could not check the remote release tag." >&2
    exit 1
  fi

  while read -r sha ref; do
    case "$ref" in
      "refs/tags/$tag") direct_sha=$sha ;;
      "refs/tags/$tag^{}") peeled_sha=$sha ;;
    esac
  done <<< "$remote_refs"

  printf '%s' "${peeled_sha:-$direct_sha}"
}

require_expected_sha() {
  local remote_sha=$1

  if [[ "$remote_sha" != "$expected_sha" ]]; then
    echo "::error::Remote tag $tag points to ${remote_sha:-nothing}, not $expected_sha."
    exit 1
  fi
  echo "Remote tag $tag points to the release commit."
}

remote_sha=$(resolve_remote_tag)
if [[ -n "$remote_sha" ]]; then
  require_expected_sha "$remote_sha"
  exit 0
fi

case "$mode" in
  optional)
    echo "Remote tag $tag does not exist."
    ;;
  required)
    require_expected_sha "$remote_sha"
    ;;
  create)
    if [[ "$(git rev-parse HEAD)" != "$expected_sha" ]]; then
      echo "::error::Checked-out commit does not match release commit $expected_sha."
      exit 1
    fi
    git tag "$tag" "$expected_sha"
    git push origin "refs/tags/$tag:refs/tags/$tag"
    remote_sha=$(resolve_remote_tag)
    require_expected_sha "$remote_sha"
    ;;
esac
