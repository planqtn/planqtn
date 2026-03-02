"""Steane [[7,1,3]] code weight enumerator analysis.

Computes the weight enumerator polynomial for the Steane code using a direct
stabilizer tensor enumerator (not the Tanner graph construction).
"""

from __future__ import annotations

import sys

# Known-good weight enumerator polynomial for verification.
STEANE_EXPECTED_WEP = {0: 1, 3: 7, 4: 7, 7: 1}


def analyze_steane_code() -> dict:
    """Compute the weight enumerator for the Steane [[7,1,3]] code.

    Returns:
        Dictionary with keys: code_type, n, k, wep, min_weight, verified.
    """
    import numpy as np
    from galois import GF2

    from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator

    # Steane code stabilizer generators in symplectic form [X | Z].
    # X stabilizers (act as X on marked qubits):
    #   X0 X2 X4 X6, X1 X2 X5 X6, X3 X4 X5 X6
    # Z stabilizers (act as Z on marked qubits):
    #   Z0 Z2 Z4 Z6, Z1 Z2 Z5 Z6, Z3 Z4 Z5 Z6
    h = GF2(
        np.array(
            [
                # X part (7 cols)            | Z part (7 cols)
                [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
            ]
        )
    )

    enumerator = StabilizerCodeTensorEnumerator(h, tensor_id=0)
    wep = enumerator.stabilizer_enumerator_polynomial()

    wep_dict = dict(wep.dict)
    min_weight = min((w for w in wep_dict if w > 0), default=0)

    return {
        "code_type": "steane_7_1_3",
        "n": 7,
        "k": 1,
        "wep": wep_dict,
        "min_weight": min_weight,
        "verified": wep_dict == STEANE_EXPECTED_WEP,
    }


if __name__ == "__main__":
    result = analyze_steane_code()
    print("Steane [[7,1,3]] code")
    print(f"  min_weight: {result['min_weight']}")
    print(f"  WEP:        {result['wep']}")
    print(f"  verified:   {result['verified']}")
    if not result["verified"]:
        print(f"  expected:   {STEANE_EXPECTED_WEP}")
        sys.exit(1)
