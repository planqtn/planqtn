from collections import defaultdict
from galois import GF2
import numpy as np

from planqtn.contraction_visitors.stabilizer_flops_cost_fn import (
    custom_flops_cost_stabilizer_codes,
)
from planqtn.legos import Legos
from planqtn.networks.compass_code import CompassCodeDualSurfaceCodeLayoutTN
from planqtn.networks.rotated_surface_code import RotatedSurfaceCodeTN
from planqtn.networks.stabilizer_measurement_state_prep import (
    StabilizerMeasurementStatePrepTN,
)


def test_custom_cost_stabilizer_codes():
    """Test the custom cost function for stabilizer codes. Should always be consistent
    if no contraction order is changed (e.g. by using cotengra)."""
    # Rotated Surface Code
    rotated_surface_tn = RotatedSurfaceCodeTN(d=3)
    cost = custom_flops_cost_stabilizer_codes(rotated_surface_tn)
    assert cost == 1062.0

    # Compass code, dual surface layout
    coloring = [[1, 2], [2, 1]]
    compass_code_dual = CompassCodeDualSurfaceCodeLayoutTN(coloring)
    cost = custom_flops_cost_stabilizer_codes(compass_code_dual)
    assert cost == 4212.0

    # 7 qubit Hamming code, measurement state prep
    # fmt: off
    H_hamming = np.array([
        [0., 0., 0., 0., 0., 0., 0., 1., 1., 1., 1., 1., 1., 1., 1., 0., 0., 0.,
            0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.],
        [0., 0., 0., 1., 1., 1., 1., 0., 0., 0., 0., 1., 1., 1., 1., 0., 0., 0.,
            0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.],
        [0., 1., 1., 0., 0., 1., 1., 0., 0., 1., 1., 0., 0., 1., 1., 0., 0., 0.,
            0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.],
        [1., 0., 1., 0., 1., 0., 1., 0., 1., 0., 1., 0., 1., 0., 1., 0., 0., 0.,
            0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.],
        [0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
            0., 0., 0., 0., 1., 1., 1., 1., 1., 1., 1., 1.],
        [0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0.,
            1., 1., 1., 1., 0., 0., 0., 0., 1., 1., 1., 1.],
        [0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 1., 1.,
            0., 0., 1., 1., 0., 0., 1., 1., 0., 0., 1., 1.],
        [0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 0., 1., 0., 1.,
            0., 1., 0., 1., 0., 1., 0., 1., 0., 1., 0., 1.]])
    # fmt: on
    tn_hamming = StabilizerMeasurementStatePrepTN(H_hamming)
    cost = custom_flops_cost_stabilizer_codes(tn_hamming)
    assert cost == 88372929773160.0
