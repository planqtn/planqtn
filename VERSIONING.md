# Versioning Policy

This project uses [Semantic Versioning (SemVer)](https://semver.org/) to manage its releases. This scheme provides clear, predictable version numbers that communicate the scope of changes between releases.

## Monorepo versioning

Both the `planqtn` library and the PlanqTN Tensor Studio are versioned together with the same version. While this might change in the future, for now it makes life easier to manage a single repo.

## Version Format

Our version numbers follow the `MAJOR.MINOR.PATCH` format.

- **`MAJOR`**: Incremented for incompatible API changes (breaking changes).
- **`MINOR`**: Incremented for new, backward-compatible functionality.
- **`PATCH`**: Incremented for backward-compatible bug fixes.

**Example:** A bug fix for version `1.2.0` would be released as `1.2.1`. A new feature would be released as `1.3.0`. A breaking change would result in version `2.0.0`. Pre-release versions are denoted with a suffix, like `2.0.0-rc.1`.

## Branching and Release Strategy

### `main` Branch

- The `main` branch is our primary development branch, containing the latest code.
- It always reflects the state of the _next_ upcoming release. This means, that the versions in the following files should agree and should be the next version, e.g. 0.1.0-alpha.1:
  - [setup.py](setup.py) for the python package
  - [app/planqtn_cli/package.json](app/planqtn_cli/package.json)
- All work is done in feature branches and merged into `main` via pull requests.

### Continuous Staging Deployments

- Every commit merged into the `main` branch automatically triggers a build and deployment to our **staging** environment.
- **Purpose**: This provides immediate, continuous feedback on the latest code in a production-like setting.
- **Note**: These deployments are for internal testing only and do **not** result in a package being published to any public registry.

### Manual Pre-Releases

To perform a full, end-to-end test of the release pipeline before a production release, we use manually-tagged pre-releases.

- **Trigger**: This workflow is kicked off by manually pushing a pre-release tag to a commit on `main` (e.g., `v2.0.0-alpha.1`). This can be any time before a planned production release to test packaging flows.
- **Action**: This tag triggers a workflow that **exactly mimics the production release process**. It will:
  1. Build all assets.
  2. Publish packages to npm, PyPI, and our container registry (e.g., Docker Hub) with the appropriate pre-release tag.
  3. Deploy the final application to the **staging** environment, triggered by the tag push.
- **Purpose**: To have a high-confidence dress rehearsal of the entire release process, catching any issues in packaging, publishing, or deployment before the final release.

### Production Releases

- **Trigger**: Production releases are created by manually pushing a final version tag to a commit on `main` (e.g., `v2.0.0`).
- **Action**: This tag triggers the finalized release pipeline, which publishes the official packages to public registries and deploys the application to the **production** environment.

## Breaking Changes

A **breaking change** is any modification that is not backward-compatible.

- With the `0.x.y` versions, our API is not considered stable, and breaking changes are expected potentially with every **`MINOR`** release.
- All breaking changes will be thoroughly documented in the release notes. This makes it clear to users that an upgrade to a new major version will require them to make changes.

After 1.0.0, which is expected in mid 2026:

- In accordance with SemVer, any breaking change will result in a **`MAJOR`** version increase.

## Bug Fixes and Patching

Our approach to bug fixes is handled through patch releases.

### Patch Releases

- If a critical bug is discovered in the latest production release that requires an immediate fix, a hotfix will be prepared. This involves:
  1. Creating a `hotfix` branch from the latest release tag on `main`.
  2. Applying the fix.
  3. Tagging a new `PATCH` version (e.g., `v1.2.1`).
  4. Merging the `hotfix` branch back into `main`.

### Supporting Older Versions

- We primarily provide support for the latest `MINOR` series. Patches are not typically backported to older minor versions. Users are encouraged to stay on the latest version.

## Summary of Strategy

| Trigger          | Branch/Tag          | Environment(s)          | Version Example  | Purpose                                       |
| :--------------- | :------------------ | :---------------------- | :--------------- | :-------------------------------------------- |
| Commit to `main` | `main`              | Staging                 | (build metadata) | Continuous integration and rapid validation.  |
| Pre-release Tag  | Tag (`v2.0.0-rc.1`) | Staging & Registries    | `2.0.0-rc.1`     | End-to-end test of the full release pipeline. |
| Production Tag   | Tag (`v2.0.0`)      | Production & Registries | `2.0.0`          | Stable, official public release.              |
