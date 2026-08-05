#!/bin/bash

UTILS_DIR="$(cd "$(dirname "$0")" && pwd)"

cd .. && sphinx-multiversion docs/source docs/_build/dirhtml \
    --pre-build "sh '$UTILS_DIR/prebuild.sh'"
