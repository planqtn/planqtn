from galois import GF2
import numpy as np
from qlego.codes.stabilizer_measurement_state_prep import (
    StabilizerMeasurementStatePrepTN,
)
from qlego.linalg import gauss


def test_5_qubit_code():
    h = GF2(
        [
            [1, 0, 0, 1, 0, 0, 1, 1, 0, 0],
            [0, 1, 0, 0, 1, 0, 0, 1, 1, 0],
            [1, 0, 1, 0, 0, 0, 0, 0, 1, 1],
            [0, 1, 0, 1, 0, 1, 0, 0, 0, 1],
        ]
    )
    tn = StabilizerMeasurementStatePrepTN(h)
    wep = tn.stabilizer_enumerator_polynomial(verbose=True)

    assert wep._dict == {0: 1, 4: 15}

    assert np.array_equal(gauss(tn.conjoin_nodes().h), gauss(h))
