"""Rotated surface code weight enumerator analysis.

Computes the weight enumerator polynomial (WEP) for a rotated surface code
of a given distance using PlanqTN tensor network contraction.
"""

from __future__ import annotations

import sys


def analyze_rotated_surface_code(
    distance: int = 5,
    truncate: int | None = None,
) -> dict:
    """Compute the weight enumerator for a rotated surface code.

    Args:
        distance: Code distance (must be odd).
        truncate: Optional truncation length for the weight enumerator.

    Returns:
        Dictionary with keys: code_type, distance, n_qubits, wep, min_weight.
    """
    from planqtn.networks.rotated_surface_code import RotatedSurfaceCodeTN

    code = RotatedSurfaceCodeTN(d=distance, truncate_length=truncate)
    wep = code.stabilizer_enumerator_polynomial()

    wep_dict = dict(wep.dict)
    # minw() returns (min_weight, coefficient) — but the identity stabilizer
    # contributes a weight-0 term, so filter w > 0 to get the code distance.
    min_weight = min((w for w in wep_dict if w > 0), default=0)

    return {
        "code_type": "rotated_surface_code",
        "distance": distance,
        "n_qubits": code.n_qubits(),
        "wep": wep_dict,
        "min_weight": min_weight,
    }


if __name__ == "__main__":
    d = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    result = analyze_rotated_surface_code(distance=d)
    print(f"Rotated surface code d={result['distance']}")
    print(f"  n_qubits:   {result['n_qubits']}")
    print(f"  min_weight: {result['min_weight']}")
    print(f"  WEP:        {result['wep']}")
