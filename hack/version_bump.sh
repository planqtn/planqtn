TAG=$(hack/image_tag)
PY_VERSION=$(cat pyproject.toml | grep version | cut -d'"' -f2)
CLI_VERSION=$(cat app/planqtn_cli/package.json | grep \"version\" | awk '{print $2}' | tr -d '",\n')
UI_VERSION=$(cat app/ui/package.json | grep \"version\" | awk '{print $2}' | tr -d '",\n')
APP_VERSION=$(cat app/package.json | grep \"version\" | awk '{print $2}' | tr -d '",\n')

echo "---------Current versions---------"

echo "Tag: $TAG"
echo "Py version: $PY_VERSION"
echo "CLI version: $CLI_VERSION"
echo "UI version: $UI_VERSION"
echo "App version: $APP_VERSION"

echo "What's the new version? (e.g. 0.1.0-alpha.3)"
read NEW_VERSION

# BSD sed (macOS) requires a backup extension after -i; use '' for none.
# GNU sed accepts plain -i for no backup.
sed_inplace() {
  if [ "$(uname -s)" = "Darwin" ]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

sed_inplace "s/^version = \".*\"/version = \"$NEW_VERSION\"/g" pyproject.toml

sed_inplace "s/^  \"version\": \".*\"/  \"version\": \"$NEW_VERSION\"/g" app/planqtn_cli/package.json
npm install --prefix app/planqtn_cli

sed_inplace "s/^  \"version\": \".*\"/  \"version\": \"$NEW_VERSION\"/g" app/ui/package.json
npm install --prefix app/ui

sed_inplace "s/^  \"version\": \".*\"/  \"version\": \"$NEW_VERSION\"/g" app/package.json
npm install --prefix app

echo "Done. Please check the changes, and commit them."