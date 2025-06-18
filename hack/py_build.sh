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

pip install --upgrade uv

TAG=$(hack/image_tag)
PKG_VERSION=$(cat pyproject.toml | grep version | cut -d'"' -f2)
echo "Package version: $PKG_VERSION"

echo "Building planqtn with tag: $TAG"

uv pip install --upgrade build twine
python -m build

if [ "$INSTALL" = true ]; then
    if [ "$PKG_VERSION" != $TAG ]; then
        echo "---------------------------------------------------------------------------------------------"
        echo "          WARNING: Package version does not match git tag: $PKG_VERSION != $TAG"
        echo "---------------------------------------------------------------------------------------------"
        echo "Still going ahead with installation of planqtn-$PKG_VERSION"
    fi
    uv pip install dist/*.whl
fi

if [ "$PUBLISH" = true ]; then
    if [ "$PKG_VERSION" != $TAG ]; then
        echo "---------------------------------------------------------------------------------------------"
        echo "          ERROR: Package version does not match git tag: $PKG_VERSION != $TAG"
        echo "---------------------------------------------------------------------------------------------"
        echo "Refusing to publish, exiting."
        exit 1
    fi
    twine upload -r testpypi dist/* 
fi