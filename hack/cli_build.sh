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

TAG=$(hack/image_tag)

echo "Building planqtn cli with tag: $TAG"

echo "JOBS_IMAGE=planqtn/planqtn_jobs:$TAG" >> app/supabase/functions/.env.local
echo "API_IMAGE=planqtn/planqtn_api:$TAG" >> app/planqtn_api/.env.local

function restore_env_file() {
    git checkout app/supabase/functions/.env.local > /dev/null 2>&1
    git checkout app/planqtn_api/.env.local > /dev/null 2>&1
}

trap restore_env_file EXIT

pushd app/planqtn_cli
npm install
npm run build 
# Run build and capture only the tarball filename
tarball=$(npm pack | tail -n 1)
echo "Tarball: $tarball"

if [ "$INSTALL" = true ]; then
    npm install -g "./$tarball" --force
    rm -rf "$tarball"
fi
popd
