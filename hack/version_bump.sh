TAG=$(hack/image_tag)
PY_VERSION=$(cat pyproject.toml | grep version | cut -d'"' -f2)
CLI_VERSION=$(cat app/planqtn_cli/package.json | grep \"version\" | awk '{print $2}' | tr -d '",\n')

echo "Tag: $TAG"
echo "Py version: $PY_VERSION"
echo "CLI version: $CLI_VERSION"

echo "What's the new version? (e.g. 0.1.0-alpha.3)"
read NEW_VERSION

echo "Bumping pyproject.toml to $NEW_VERSION"
sed -i "s/^version = \".*\"/version = \"$NEW_VERSION\"/g" pyproject.toml

echo "Bumping app/planqtn_cli/package.json to $NEW_VERSION"
sed -i "s/^  \"version\": \".*\"/  \"version\": \"$NEW_VERSION\"/g" app/planqtn_cli/package.json

echo "Building cli to test version bump, and sync package.lock.json"
hack/cli_build.sh 

echo "Done. Please check the changes, and commit them."