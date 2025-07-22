from galois import GF2

from planqtn.networks.compass_code import CompassCodeDualSurfaceCodeLayoutTN
from planqtn.networks.css_tanner_code import CssTannerCodeTN


def test_tanner_graph_enumerator():
    hz = GF2(
        [
            [1, 1, 0, 1, 1, 0, 1, 1, 0],
            [0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 1, 1],
        ]
    )

    hx = GF2(
        [
            [1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 1],
        ]
    )

    tn = CssTannerCodeTN(hx, hz)

    wep = tn.stabilizer_enumerator_polynomial(verbose=True)
    tn = CompassCodeDualSurfaceCodeLayoutTN(
        [
            [1, 1],
            [2, 1],
        ]
    )

    expected_wep = tn.stabilizer_enumerator_polynomial()

    assert wep == expected_wep
