import numpy as np

from planqtn.contraction_visitors.stabilizer_flops_cost_fn import (
    StabilizerCodeFlopsCostVisitor,
)

from planqtn.networks.compass_code import CompassCodeDualSurfaceCodeLayoutTN
from planqtn.networks.rotated_surface_code import RotatedSurfaceCodeTN
from planqtn.networks.stabilizer_measurement_state_prep import (
    StabilizerMeasurementStatePrepTN,
)
from planqtn.tensor_network import Contraction


def test_custom_cost_stabilizer_codes():
    """Test the custom cost function for stabilizer codes. Should always be consistent
    if no contraction order is changed (e.g. by using cotengra)."""
    # Rotated Surface Code
    rotated_surface_tn = RotatedSurfaceCodeTN(d=3)
    contraction = Contraction(
        rotated_surface_tn,
        lambda node: node.copy(),
    )

    stabilizer_cost_visitor = StabilizerCodeFlopsCostVisitor()
    contraction.contract(
        visitors=[stabilizer_cost_visitor],
        cotengra=False,
        verbose=False,
    )
    cost = stabilizer_cost_visitor.total_cost
    assert cost == 148.0

    # Compass code, dual surface layout
    coloring = [[1, 2], [2, 1]]
    compass_code_dual = CompassCodeDualSurfaceCodeLayoutTN(coloring)
    contraction = Contraction(
        compass_code_dual,
        lambda node: node.copy(),
    )
    stabilizer_cost_visitor = StabilizerCodeFlopsCostVisitor()
    contraction.contract(
        visitors=[stabilizer_cost_visitor],
        cotengra=False,
        verbose=False,
    )
    cost = stabilizer_cost_visitor.total_cost
    assert cost == 380.0

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
    contraction = Contraction(
        tn_hamming,
        lambda node: node.copy(),
    )
    stabilizer_cost_visitor = StabilizerCodeFlopsCostVisitor()
    contraction.contract(
        visitors=[stabilizer_cost_visitor],
        cotengra=False,
        verbose=False,
    )
    cost = stabilizer_cost_visitor.total_cost
    assert cost == 714219282658.0
