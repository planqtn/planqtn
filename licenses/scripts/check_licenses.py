#!/usr/bin/env python3
"""
Advanced license compatibility checker for Apache 2.0 licensed projects.
"""
import json
import csv
import sys
import os
from pathlib import Path
from typing import Dict, List, Tuple, Set


def load_config() -> Dict:
    """Load license configuration from JSON file."""
    config_path = Path(__file__).parent / ".." / "license-config.json"
    with open(config_path, "r") as f:
        return json.load(f)


def normalize_license(license_str: str) -> str:
    """Normalize license string for comparison."""
    # Remove common variations and normalize
    license_str = license_str.strip()

    # Handle dual licenses - take the first one for simplicity
    if ";" in license_str:
        license_str = license_str.split(";")[0].strip()

    # Handle "AND" licenses - take the first one
    if " AND " in license_str:
        license_str = license_str.split(" AND ")[0].strip()

    # Common normalizations
    normalizations = {
        "Apache Software License": "Apache-2.0",
        "Apache License 2.0": "Apache-2.0",
        "MIT License": "MIT",
        "BSD License": "BSD",
        "ISC License (ISCL)": "ISC",
        "The Unlicense (Unlicense)": "Unlicense",
        "Mozilla Public License 2.0 (MPL 2.0)": "MPL-2.0",
        "Python Software Foundation License": "PSF",
    }

    return normalizations.get(license_str, license_str)


def check_python_licenses(
    csv_file: str, config: Dict
) -> Tuple[List[str], List[str], List[str]]:
    """
    Check Python licenses from pip-licenses CSV output.

    Returns:
        Tuple of (compatible, needs_review, prohibited)
    """
    compatible = []
    needs_review = []
    prohibited = []

    allowed = set(config["apache_2_compatible"]["allowed"])
    review = set(config["apache_2_compatible"]["requires_review"])
    forbidden = set(config["apache_2_compatible"]["prohibited"])
    exceptions = config["exceptions"]
    manual_lookups = config.get("manual_license_lookups", {})

    with open(csv_file, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            package_name = row["Name"]
            license_name = row["License"]

            # Check for exceptions first
            if package_name in exceptions:
                compatible.append(
                    f"{package_name}: {license_name} (Exception: {exceptions[package_name]['reason']})"
                )
                continue

            # Check for manual license lookups
            if package_name in manual_lookups and license_name == "UNKNOWN":
                manual_info = manual_lookups[package_name]
                actual_license = manual_info["license_type"]
                reason = manual_info["reason"]

                # Check if the manually looked up license is compatible
                if any(
                    allowed_license in actual_license for allowed_license in allowed
                ):
                    compatible.append(
                        f"{package_name}: {actual_license} (Manual lookup: {reason})"
                    )
                elif any(review_license in actual_license for review_license in review):
                    needs_review.append(
                        f"{package_name}: {actual_license} (Manual lookup: {reason})"
                    )
                elif any(
                    forbidden_license in actual_license
                    for forbidden_license in forbidden
                ):
                    prohibited.append(
                        f"{package_name}: {actual_license} (Manual lookup: {reason})"
                    )
                else:
                    needs_review.append(
                        f"{package_name}: {actual_license} (Manual lookup - unknown pattern: {reason})"
                    )
                continue

            normalized_license = normalize_license(license_name)

            # Check if license is in allowed list
            if any(
                allowed_license in normalized_license for allowed_license in allowed
            ):
                compatible.append(f"{package_name}: {license_name}")

            # Check if license needs review
            elif any(review_license in normalized_license for review_license in review):
                needs_review.append(f"{package_name}: {license_name}")

            # Check if license is prohibited
            elif any(
                forbidden_license in normalized_license
                for forbidden_license in forbidden
            ):
                prohibited.append(f"{package_name}: {license_name}")

            # Unknown license pattern
            else:
                needs_review.append(f"{package_name}: {license_name} (Unknown pattern)")

    return compatible, needs_review, prohibited


def check_npm_licenses(
    summary_file: str, config: Dict
) -> Tuple[List[str], List[str], List[str]]:
    """
    Check npm licenses from license-checker summary output.

    Returns:
        Tuple of (compatible, needs_review, prohibited)
    """
    compatible = []
    needs_review = []
    prohibited = []

    allowed = set(config["apache_2_compatible"]["allowed"])
    review = set(config["apache_2_compatible"]["requires_review"])
    forbidden = set(config["apache_2_compatible"]["prohibited"])

    with open(summary_file, "r") as f:
        for line in f:
            if "├─" in line or "└─" in line:
                # Parse license summary line
                parts = line.split(": ")
                if len(parts) >= 2:
                    license_part = parts[0].replace("├─", "").replace("└─", "").strip()
                    count = parts[1].strip()

                    normalized_license = normalize_license(license_part)

                    # Check license compatibility
                    if any(
                        allowed_license in normalized_license
                        for allowed_license in allowed
                    ):
                        compatible.append(f"{license_part}: {count}")
                    elif any(
                        review_license in normalized_license
                        for review_license in review
                    ):
                        needs_review.append(f"{license_part}: {count}")
                    elif any(
                        forbidden_license in normalized_license
                        for forbidden_license in forbidden
                    ):
                        prohibited.append(f"{license_part}: {count}")
                    else:
                        needs_review.append(
                            f"{license_part}: {count} (Unknown pattern)"
                        )

    return compatible, needs_review, prohibited


def print_results(
    component: str,
    compatible: List[str],
    needs_review: List[str],
    prohibited: List[str],
) -> bool:
    """Print results for a component. Returns True if check passes."""
    print(f"\n{'='*60}")
    print(f"📋 {component} License Check Results")
    print(f"{'='*60}")

    if compatible:
        print(f"\n✅ COMPATIBLE LICENSES ({len(compatible)}):")
        for item in compatible:
            print(f"  ✓ {item}")

    if needs_review:
        print(f"\n⚠️  LICENSES NEEDING REVIEW ({len(needs_review)}):")
        for item in needs_review:
            print(f"  ⚠️  {item}")
        print("\n📝 These licenses may be compatible but should be reviewed manually.")

    if prohibited:
        print(f"\n❌ PROHIBITED LICENSES ({len(prohibited)}):")
        for item in prohibited:
            print(f"  ❌ {item}")
        print("\n🚫 These licenses are incompatible with Apache 2.0!")
        return False

    print(f"\n{'='*60}")
    return True


def main():
    """Main function."""
    config = load_config()

    # Check if we're in GitHub Actions
    is_github_actions = os.environ.get("GITHUB_ACTIONS") == "true"

    all_passed = True

    # Check Python licenses

    python_csv = "licenses/python-licenses.csv"
    if os.path.exists(python_csv):
        compatible, needs_review, prohibited = check_python_licenses(python_csv, config)
        passed = print_results(
            "Python Dependencies", compatible, needs_review, prohibited
        )
        all_passed = all_passed and passed

        # Check UI licenses
    ui_summary = "licenses/ui-licenses-summary.txt"
    if os.path.exists(ui_summary):
        compatible, needs_review, prohibited = check_npm_licenses(ui_summary, config)
        passed = print_results(
            "UI Component Dependencies", compatible, needs_review, prohibited
        )
        all_passed = all_passed and passed

        # Check CLI licenses
    cli_summary = "licenses/cli-licenses-summary.txt"
    if os.path.exists(cli_summary):
        compatible, needs_review, prohibited = check_npm_licenses(cli_summary, config)
        passed = print_results(
            "CLI Component Dependencies", compatible, needs_review, prohibited
        )
        all_passed = all_passed and passed

    # Final summary
    print(f"\n{'='*60}")
    if all_passed:
        print("🎉 LICENSE CHECK PASSED!")
        print("All dependencies are compatible with Apache 2.0 license.")
        if is_github_actions:
            print("::notice::License check passed - all dependencies are compatible")
    else:
        print("❌ LICENSE CHECK FAILED!")
        print("Some dependencies have incompatible licenses.")
        if is_github_actions:
            print("::error::License check failed - incompatible licenses found")
    print(f"{'='*60}")

    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
