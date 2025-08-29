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
from planqtn.contraction_visitors.utils import count_matching_stabilizers_ratio
from planqtn.stabilizer_tensor_enumerator import _index_leg


def test_count_matching_stabilizer_ratio():
    # Test with the [[4,2,2]] code
    gens = Legos.stab_code_parity_422
    ratio = count_matching_stabilizers_ratio(gens)
    assert ratio == 1.0  # All stabilizers match

    # Test with the Hadamard tensor
    gens = Legos.h
    ratio = count_matching_stabilizers_ratio(gens)
    assert ratio == 0.5  # Half of the stabilizers match

    # Test with a custom generator matrix
    gens = GF2([[1, 0, 0, 0], [0, 0, 1, 1], [0, 1, 0, 0]])
    ratio = count_matching_stabilizers_ratio(gens)
    assert ratio == 0.5

    # Test with a custom generator matrix
    gens = GF2([[1, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]])
    ratio = count_matching_stabilizers_ratio(gens)
    assert ratio == 0.25


def get_open_legs(tn):
    free_legs, _, _ = tn._collect_legs()

    open_legs_per_node = defaultdict(list)
    for node_idx, node in tn.nodes.items():
        for leg in node.legs:
            if leg not in free_legs:
                open_legs_per_node[node_idx].append(_index_leg(node_idx, leg))
    return open_legs_per_node


def test_custom_cost_stabilizer_codes():
    """Test the custom cost function for stabilizer codes. Should always be consistent
    if no contraction order is changed (e.g. by using cotengra)."""
    # Rotated Surface Code
    rotated_surface_tn = RotatedSurfaceCodeTN(d=3)
    cost = custom_flops_cost_stabilizer_codes(
        rotated_surface_tn, get_open_legs(rotated_surface_tn)
    )
    assert cost == 254.0

    # Compass code, dual surface layout
    coloring = [[1, 2], [2, 1]]
    compass_code_dual = CompassCodeDualSurfaceCodeLayoutTN(coloring)
    cost = custom_flops_cost_stabilizer_codes(
        compass_code_dual, get_open_legs(compass_code_dual)
    )
    assert cost == 1052.0

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
    cost = custom_flops_cost_stabilizer_codes(tn_hamming, get_open_legs(tn_hamming))
    assert cost == 1191059185930.0
