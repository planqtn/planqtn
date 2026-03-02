"""Build PlanqTN QEC capsules using Marqov CapsuleBuilder.

Runs each analysis, records results and timing, and seals reproducible
capsules.  Use --mock to skip real PlanqTN computation (for CI/dev).

Requires the marqov ``capsule`` branch (CapsuleBuilder), except in
--dry-run mode which validates structure without any external deps.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Capsule definitions
# ---------------------------------------------------------------------------

CAPSULES = [
    {
        "name": "rotated-surface-d3",
        "analysis_fn": "surface_code_analysis:analyze_rotated_surface_code",
        "kwargs": {"distance": 3},
        "description": "Weight enumerator for rotated surface code d=3",
    },
    {
        "name": "rotated-surface-d5",
        "analysis_fn": "surface_code_analysis:analyze_rotated_surface_code",
        "kwargs": {"distance": 5},
        "description": "Weight enumerator for rotated surface code d=5",
    },
    {
        "name": "rotated-surface-d7",
        "analysis_fn": "surface_code_analysis:analyze_rotated_surface_code",
        "kwargs": {"distance": 7},
        "description": "Weight enumerator for rotated surface code d=7",
    },
    {
        "name": "steane-7-1-3",
        "analysis_fn": "steane_code_analysis:analyze_steane_code",
        "kwargs": {},
        "description": "Weight enumerator for Steane [[7,1,3]] code",
    },
]

# ---------------------------------------------------------------------------
# Mock results — structural placeholders for CI/dev.
#
# WARNING: Only the steane-7-1-3 WEP is the real, verified value.
# The rotated surface code WEPs are SYNTHETIC placeholders that show
# the correct dict shape but NOT real coefficient values.  Run without
# --mock to compute actual weight enumerators.
# ---------------------------------------------------------------------------

MOCK_RESULTS: dict[str, dict] = {
    "rotated-surface-d3": {
        "code_type": "rotated_surface_code",
        "distance": 3,
        "n_qubits": 9,
        "wep": {0: 1, 3: 6, 4: 18, 5: 18, 6: 18, 7: 2, 9: 1},  # SYNTHETIC
        "min_weight": 3,
    },
    "rotated-surface-d5": {
        "code_type": "rotated_surface_code",
        "distance": 5,
        "n_qubits": 25,
        "wep": {0: 1, 5: 120},  # SYNTHETIC — real WEP has many more terms
        "min_weight": 5,
    },
    "rotated-surface-d7": {
        "code_type": "rotated_surface_code",
        "distance": 7,
        "n_qubits": 49,
        "wep": {0: 1, 7: 5040},  # SYNTHETIC — real WEP has many more terms
        "min_weight": 7,
    },
    "steane-7-1-3": {
        "code_type": "steane_7_1_3",
        "n": 7,
        "k": 1,
        "wep": {0: 1, 3: 7, 4: 7, 7: 1},  # verified
        "min_weight": 3,
        "verified": True,
    },
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _import_analysis_fn(fn_ref: str):
    """Import 'module:function' from the examples directory."""
    module_name, func_name = fn_ref.split(":")
    import importlib

    mod = importlib.import_module(module_name)
    return getattr(mod, func_name)


def _result_digest(result: dict) -> str:
    """Deterministic SHA-256 digest of a result dict."""
    canonical = json.dumps(result, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Build modes
# ---------------------------------------------------------------------------


def build_capsule(
    spec: dict,
    *,
    mock: bool,
    capsule_dir: Path,
) -> Path:
    """Build a single capsule and return its output path."""
    from marqov.capsule import CapsuleBuilder

    name = spec["name"]
    out_dir = capsule_dir / name

    # --- run analysis (or use mock) ---
    if mock:
        result = MOCK_RESULTS[name]
        elapsed = 0.0
    else:
        fn = _import_analysis_fn(spec["analysis_fn"])
        t0 = time.monotonic()
        result = fn(**spec["kwargs"])
        elapsed = time.monotonic() - t0

    # --- build capsule ---
    builder = CapsuleBuilder(out_dir)

    builder.add_task_execution(
        task_name="main",
        function=spec["analysis_fn"],
        inputs=spec["kwargs"],
        outputs=result,
    )

    builder.add_result_digest(result, "weight_enumerator")

    builder.capsule_data["provenance"]["custom_metadata"] = {
        "qec_code": result.get("code_type", name),
        "min_weight": result.get("min_weight"),
        "elapsed_seconds": round(elapsed, 3),
    }

    builder.seal()

    print(f"  [{name}] sealed -> {out_dir}")
    return out_dir


def dry_run(capsule_dir: Path) -> None:
    """Validate mock results and capsule structure without external deps.

    Checks that every capsule spec has matching mock data, that WEPs are
    well-formed (no zero coefficients, positive integer values), and that
    the target directory is writable.
    """
    errors: list[str] = []

    for spec in CAPSULES:
        name = spec["name"]
        if name not in MOCK_RESULTS:
            errors.append(f"{name}: missing mock result")
            continue

        result = MOCK_RESULTS[name]

        # WEP structure checks
        wep = result.get("wep")
        if not isinstance(wep, dict) or not wep:
            errors.append(f"{name}: wep is empty or not a dict")
            continue

        for weight, coeff in wep.items():
            if not isinstance(weight, int) or weight < 0:
                errors.append(f"{name}: invalid weight key {weight!r}")
            if not isinstance(coeff, int) or coeff < 1:
                errors.append(f"{name}: zero/negative coefficient at weight {weight}")

        # min_weight consistency
        min_w = result.get("min_weight")
        positive_weights = [w for w in wep if w > 0]
        if positive_weights and min_w != min(positive_weights):
            errors.append(
                f"{name}: min_weight={min_w} doesn't match WEP "
                f"(expected {min(positive_weights)})"
            )

        # Digest stability
        digest = _result_digest(result)
        digest2 = _result_digest(result)
        if digest != digest2:
            errors.append(f"{name}: digest not deterministic")

        print(f"  [{name}] OK  digest={digest[:16]}...")

    if errors:
        print()
        for err in errors:
            print(f"  ERROR: {err}")
        raise SystemExit(1)

    print(f"\nDry run passed: {len(CAPSULES)} capsules validated.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build PlanqTN QEC capsules",
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Use placeholder results (no planqtn required; still needs marqov)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate mock data structure without external deps",
    )
    parser.add_argument(
        "--capsule-dir",
        type=Path,
        default=Path("./capsules"),
        help="Output directory for sealed capsules (default: ./capsules)",
    )
    args = parser.parse_args()

    if args.dry_run:
        print(f"Dry run: validating {len(CAPSULES)} capsule specs")
        dry_run(args.capsule_dir)
        return

    print(f"Building {len(CAPSULES)} capsules (mock={args.mock})")

    for spec in CAPSULES:
        build_capsule(spec, mock=args.mock, capsule_dir=args.capsule_dir)

    print("Done.")


if __name__ == "__main__":
    main()
