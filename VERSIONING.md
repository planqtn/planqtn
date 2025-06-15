# Versioning Policy

This project uses a date-based versioning scheme, specifically [CalVer](https://calver.org/), to label its releases. This method helps us tie releases to our development timeline and provides a clear understanding of a version's age.

## Version Format

Our version numbers follow the `YY.MM.MICRO` format.

* **`YY`**: The two-digit year of the release.
* **`MM`**: The two-digit month of the release.
* **`MICRO`**: A number that increments with each release within the same month, starting from `0`.

**Example:** The first release in June 2025 would be `25.06.0`. A subsequent release in the same month would be `25.06.1`.

## Branching and Release Strategy

### `main` Branch and Staging

* The `main` branch is our primary development branch.
* All changes are first merged into the `main` branch.

### Pre-releases on Staging

To ensure our packaging and deployment pipeline is sound for a production release, every merge to `main` is treated as a pre-release candidate.

* **Action**: A pre-release version is automatically built and deployed to our **staging** environment. These packages are **not** published to public registries like npm or PyPI.
* **Format**: These staging versions are tagged with a `dev` suffix, such as `YY.MM.MICRO-dev.BUILD_NUMBER` (e.g., `25.06.0-dev.123`).
* **Purpose**: This process validates that the package builds correctly and allows for thorough testing of the release candidate in a production-like environment before a final production release is made.

### Production Releases

* Production releases are created by tagging a specific commit on the `main` branch with a new version number.
* A new release is typically made at the beginning of each month, or more frequently if needed.
* A release to production always corresponds to a clean version tag (e.g., `25.06.0`) and is published to public package registries.

## Breaking Changes

A **breaking change** is any modification that is not backward-compatible.

* When a release includes breaking changes, it will be clearly noted in the release notes.
* Because we use a date-based system, the version number itself does not signal a breaking change. It is crucial to read the release notes before upgrading.

## Bug Fixes and Patching

Our approach to bug fixes depends on the severity and scope of the issue.

### Hotfixes for the Latest Version

* If a critical bug is discovered in the latest production release, a hotfix will be prepared.
* This will result in a new `MICRO` version. For example, if `25.06.0` has a critical bug, a fix will be released as `25.06.1`.
* The fix will be developed in a separate `hotfix` branch from the release tag, merged back into `main`, and then a new release tag will be created.

### Supporting Older Versions

* We do not provide long-term support (LTS) for every past version.
* Significant, non-critical bug fixes will be included in the next regular release. For example, a bug found in `25.06.0` would be fixed in the `main` branch and released as part of `25.07.0`.
* Users are encouraged to stay on the latest version to benefit from all bug fixes and improvements.

## Summary of Strategy

| Branch | Environment | Version | Purpose |
| :--- | :--- | :--- | :--- |
| `main` | Staging | `YY.MM.MICRO-dev.BUILD` | Continuous testing & validation of release candidates. |
| Tag | Production | `YY.MM.MICRO` | Stable, public releases published to registries. |
| `hotfix/*` | - | - | Urgent bug fixes for a production release. |