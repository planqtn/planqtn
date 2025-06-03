#!/bin/bash

set -e

INSTALL=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --install)
            INSTALL=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

pushd app/planqtn_cli
npm install
npm run build 
if [ "$INSTALL" = true ]; then
    npm install -g .
fi
popd