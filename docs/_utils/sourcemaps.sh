#!/bin/bash
#
# Emit TypeScript source maps and reduce them to a compiled-to-source line
# table for the jsdoc_content Sphinx extension.
#
# JSDoc parses the compiled .js, whose line numbers drift from the .ts
# sources because tsc strips blank lines and collapses statements.  The maps
# let the extension translate those line numbers back.
#
# They are written under the docs build directory only, so the published npm
# package is unaffected.
#
# Usage: sourcemaps.sh [output-dir]   (path relative to the tree being built)

set -eu

UTILS_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-docs/_build/sourcemaps}"

npx tsc -p tsconfig.build.json \
    --sourceMap --declaration false --emitDeclarationOnly false \
    --rootDir . --outDir "$OUT" || true

node "$UTILS_DIR/line-table.js" "$OUT" lib
