#!/bin/bash

set -e
set +x
PUBLISH=false
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

PROD_FLAG=""
if [ "$PUBLISH" = true ]; then
    PROD_FLAG="-- --prod"
    if [ -z "$NPM_TOKEN" ]; then
        echo "NPM_TOKEN is not set, exiting."
        exit 1
    fi
fi



pushd app/planqtn_cli

echo "Installing dependencies"
npm install --include=dev > $tmp_log 2>&1



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
    TAG=$(hack/image_tag)
    if [[ "$TAG" =~ ^.*-alpha\.[0-9]+$ ]]; then
        echo "Publishing PRERELEASE $tarball to npm with --tag $TAG"
        npm publish $tarball --tag $TAG    
    else
        echo "Publishing PRODUCTION $tarball to npm with @latest = $TAG"
        npm publish $tarball    
    fi
fi
popd
