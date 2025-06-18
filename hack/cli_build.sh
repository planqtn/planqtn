#!/bin/bash

set -e
set +x

INSTALL=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --install)
            INSTALL=true
            shift
            ;;
        --publish)
            PUBLISH=true
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

export tmp_log=$(mktemp)

function restore_env_file() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then        
        cat $tmp_log
    fi    
    set +e
    popd > /dev/null 2>&1 || true

}

trap restore_env_file EXIT KILL TERM INT

pushd app/planqtn_cli

echo "Installing dependencies"
npm install > $tmp_log 2>&1

PROD_FLAG=""
if [ "$PUBLISH" = true ]; then
    PROD_FLAG="-- --prod"
fi

echo "Building cli"
npm run build $PROD_FLAG > $tmp_log 2>&1


if [ "$INSTALL" = true ] || [ "$PUBLISH" = true ]; then
    echo "npm pack"
    tarball=$(npm pack | tail -n 1)    
    echo "Tarball: $tarball"
fi

if [ "$INSTALL" = true ]; then
    echo "Installing $tarball"
    npm install -g "./$tarball" --force > $tmp_log 2>&1
fi

if [ "$PUBLISH" = true ]; then
    echo "Publishing $tarball to npm"
    npm publish $tarball    
fi
popd
