from galois import GF2
import numpy as np
from planqtn.networks.stabilizer_tanner_code import StabilizerTannerCodeTN
from planqtn.linalg import gauss


def test_5_qubit_code():
    h = GF2(
        [
            [1, 0, 0, 1, 0, 0, 1, 1, 0, 0],
            [0, 1, 0, 0, 1, 0, 0, 1, 1, 0],
            [1, 0, 1, 0, 0, 0, 0, 0, 1, 1],
            [0, 1, 0, 1, 0, 1, 0, 0, 0, 1],
        ]
    )
    tn = StabilizerTannerCodeTN(h)
    wep = tn.stabilizer_enumerator_polynomial(verbose=False)

    assert wep.dict == {0: 1, 4: 15}
    tn = StabilizerTannerCodeTN(h)

    assert np.array_equal(gauss(tn.conjoin_nodes().h), gauss(h))
