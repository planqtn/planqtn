"""Generic CSS Tanner code weight enumerator analysis.

Computes the weight enumerator polynomial for a CSS code defined by
Hx and Hz parity check matrices.
"""

from __future__ import annotations


# Steane [[7,1,3]] code parity check matrices for standalone demo.
STEANE_HX = [
    [1, 0, 1, 0, 1, 0, 1],
    [0, 1, 1, 0, 0, 1, 1],
    [0, 0, 0, 1, 1, 1, 1],
]

STEANE_HZ = [
    [1, 0, 1, 0, 1, 0, 1],
    [0, 1, 1, 0, 0, 1, 1],
    [0, 0, 0, 1, 1, 1, 1],
]


def analyze_css_code(
    hx: list[list[int]],
    hz: list[list[int]],
) -> dict:
    """Compute the weight enumerator for a CSS code.

    Args:
        hx: X-type parity check matrix as nested lists of 0/1.
        hz: Z-type parity check matrix as nested lists of 0/1.

    Returns:
        Dictionary with keys: code_type, n_qubits, hx_shape, hz_shape,
        wep, min_weight.
    """
    import numpy as np
    from galois import GF2

    from planqtn.networks.css_tanner_code import CssTannerCodeTN

    hx_gf2 = GF2(np.array(hx))
    hz_gf2 = GF2(np.array(hz))

    code = CssTannerCodeTN(hx=hx_gf2, hz=hz_gf2)
    wep = code.stabilizer_enumerator_polynomial()

    wep_dict = dict(wep.dict)
    min_weight = min((w for w in wep_dict if w > 0), default=0)

    return {
        "code_type": "css_tanner_code",
        "n_qubits": hx_gf2.shape[1],
        "hx_shape": list(hx_gf2.shape),
        "hz_shape": list(hz_gf2.shape),
        "wep": wep_dict,
        "min_weight": min_weight,
    }


if __name__ == "__main__":
    print("CSS Tanner code analysis — Steane [[7,1,3]] code")
    result = analyze_css_code(hx=STEANE_HX, hz=STEANE_HZ)
    print(f"  n_qubits:   {result['n_qubits']}")
    print(f"  min_weight: {result['min_weight']}")
    print(f"  WEP:        {result['wep']}")
