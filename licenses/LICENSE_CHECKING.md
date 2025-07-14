# Automated License Checking System

This document describes the automated license checking system for PlanqTN, which ensures all dependencies are compatible with the Apache 2.0 license.

## Overview

The system checks licenses for all dependencies across:

- **Python packages** (via pip-licenses)
- **npm packages** (via license-checker)
- **Deno dependencies** (via custom checker)

## Components

### 1. GitHub Actions Workflow (`.github/workflows/license-check.yml`)

The main workflow that runs:

- On every push to main/develop branches
- On pull requests
- Weekly on schedule
- Can be triggered manually

### 2. License Configuration (`licenses/license-config.json`)

Defines license categories:

- **Allowed**: Compatible with Apache 2.0
- **Requires Review**: May be compatible but needs manual verification
- **Prohibited**: Incompatible with Apache 2.0

### 3. License Checker Scripts

#### Python License Checker

- Uses `pip-licenses` tool
- Checks all Python dependencies from:
  - Main project (`pyproject.toml`)
  - API module (`app/planqtn_api/requirements.txt`)
  - Jobs module (`app/planqtn_jobs/requirements.txt`)
  - Types module (`app/planqtn_types/requirements.txt`)

#### npm License Checker

- Uses `license-checker` tool
- Checks dependencies from:
  - UI component (`app/ui/package.json`)
  - CLI component (`app/planqtn_cli/package.json`)

#### Deno License Checker (`licenses/scripts/check_deno_licenses.ts`)

- Custom TypeScript script for Deno dependencies
- Checks imports from:
  - Supabase Edge Functions (`app/supabase/functions/`)
  - Import maps (`app/supabase/functions/import_map.json`)
- Supports registries:
  - NPM packages (via `npm:` prefix)
  - JSR packages (via `jsr:` prefix)
  - Deno.land packages (via `https://deno.land/x/`)
  - ESM.sh packages (via `https://esm.sh/`)

## License Compatibility

### ✅ Compatible Licenses

- MIT
- BSD (all variants)
- Apache 2.0
- ISC
- Unlicense
- CC0-1.0
- Python Software Foundation License
- CC-BY-4.0

### ⚠️ Requires Review

- Mozilla Public License 2.0 (MPL-2.0)
- Custom licenses
- UNKNOWN licenses
- Python-2.0

### ❌ Prohibited Licenses

- GPL (all variants)
- LGPL (all variants)
- AGPL (all variants)
- CDDL
- EPL
- EUPL
- OSL
- SSPL
- BUSL

## Running Locally

### Python Dependencies

```bash
pip install pip-licenses
pip install -e .
pip install -r app/planqtn_api/requirements.txt
pip install -r app/planqtn_jobs/requirements.txt
pip install -r app/planqtn_types/requirements.txt
pip-licenses --format=csv --output-file=python-licenses.csv
```

### npm Dependencies

```bash
npm install -g license-checker

# UI Component
cd app/ui && npm install
license-checker --csv --out ui-licenses.csv

# CLI Component
cd app/planqtn_cli && npm install
license-checker --csv --out cli-licenses.csv
```

### Deno Dependencies

```bash
deno run --allow-net --allow-read .github/scripts/check_deno_licenses.ts
```

## Workflow Outputs

### Artifacts

The workflow generates downloadable artifacts:

- `python-licenses.csv` - Python dependency licenses
- `ui-licenses.csv` - UI component licenses
- `cli-licenses.csv` - CLI component licenses
- `deno-license-report.txt` - Deno dependency report

### Pull Request Comments

For pull requests, the workflow automatically posts a comment with:

- Summary of license checks
- Overview of each component's licenses
- Link to detailed artifacts

## Handling License Issues

### Unknown Licenses

When packages show "UNKNOWN" license:

1. Check the package's repository for license information
2. Update `.github/license-config.json` with exceptions if needed
3. Consider finding alternative packages with clear licenses

### Prohibited Licenses

If prohibited licenses are found:

1. Replace the package with a compatible alternative
2. If no alternative exists, consult legal counsel
3. Document any necessary exceptions with legal approval

### Adding Exceptions

To add license exceptions, update `.github/license-config.json`:

```json
{
  "exceptions": {
    "package-name": {
      "reason": "Explanation for why this exception is acceptable",
      "allowed_license": "Actual license to use"
    }
  }
}
```

### Adding Manual License Lookups

For packages with "UNKNOWN" licenses, you can manually specify their actual licenses:

#### Python Packages

```json
{
  "manual_license_lookups": {
    "package-name": {
      "license_type": "MIT License",
      "license_url": "https://raw.githubusercontent.com/owner/repo/main/LICENSE",
      "reason": "Package metadata reports UNKNOWN but actual license is MIT",
      "verified_date": "2025-07-14"
    }
  }
}
```

#### Deno Dependencies

```json
{
  "deno_manual_license_lookups": {
    "package-name": {
      "license_type": "Apache-2.0",
      "license_url": "https://raw.githubusercontent.com/owner/repo/main/LICENSE",
      "reason": "Package metadata reports UNKNOWN but actual license is Apache-2.0",
      "verified_date": "2025-07-14"
    },
    "https://esm.sh/package@version": {
      "license_type": "MIT License",
      "license_url": "https://example.com/license",
      "reason": "Full URL lookup for specific import",
      "verified_date": "2025-07-14"
    }
  }
}
```

## Maintenance

### Updating License Lists

Periodically review and update:

- Compatible license list (may expand)
- Prohibited license list (legal requirements may change)
- Package-specific exceptions

### Monitoring

- Review weekly scheduled runs
- Address any new license incompatibilities promptly
- Keep license checking tools updated

## Troubleshooting

### Common Issues

1. **False Positives**: Some packages may report incorrect license information

   - Solution: Check package source and add exceptions

2. **API Rate Limits**: Registry APIs may have rate limits

   - Solution: Run checks less frequently or implement caching

3. **Network Issues**: Registry lookups may fail

   - Solution: Retry mechanism in workflows

4. **Version Conflicts**: Different versions may have different licenses
   - Solution: Pin versions and document license implications

### Support

For questions about license compatibility:

1. Check this documentation
2. Review existing issues/discussions
3. Consult legal counsel for complex cases
4. Create GitHub issue for technical problems

## Best Practices

1. **Regular Monitoring**: Don't ignore license check failures
2. **Proactive Updates**: Review license implications before adding dependencies
3. **Documentation**: Keep exceptions well-documented
4. **Legal Review**: Consult legal counsel for ambiguous cases
5. **Automation**: Rely on automated checks rather than manual review

## References

- [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0)
- [SPDX License List](https://spdx.org/licenses/)
- [Choose a License](https://choosealicense.com/)
- [License Compatibility Chart](https://www.gnu.org/licenses/license-list.html)
