#!/bin/bash

pushd ../..
set -e
mkdocs build --strict --site-dir app/ui/public/docs
popd