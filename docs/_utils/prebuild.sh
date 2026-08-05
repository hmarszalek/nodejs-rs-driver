#!/bin/bash
#
# Everything that has to happen before Sphinx runs: build the driver, run
# JSDoc over it, and generate the API pages.
#
# Shared by both entry points so they cannot drift apart
# (Makefile and _utils/multiversion.sh).

set -eu

UTILS_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "${1:-.}"

npm install
npm run build
npm run js-doc

sh "$UTILS_DIR/sourcemaps.sh" docs/_build/sourcemaps

python docs/_utils/generate_api_pages.py
