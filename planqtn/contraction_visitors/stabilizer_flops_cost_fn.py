"""Calculates the cost of contracting a stabilizer code tensor network
based only on the parity check matrix."""

from typing import TYPE_CHECKING, Dict, Set, List, Tuple

import numpy as np

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.symplectic import count_matching_stabilizers_ratio, count_matching_stabilizers_ratio_all_pairs, find_matching_stabilizers
from planqtn.parity_check import tensor_product
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

if TYPE_CHECKING:
    from ..tensor_network import TensorNetwork

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


def custom_flops_cost_stabilizer_codes(contraction) -> int:
    """This function uses the StabilizerCodeCostVisitor to compute the total cost of a stabilizer
    code tensor network contraction. The visitor calculates the cost of a contraction step during
    the conjoining of nodes in the tensor network.

    Args:
        tn (TensorNetwork): The tensor network to analyze.
        open_legs_per_node (dict): A dictionary mapping node indices to lists of open legs.

    Returns:
        int: The total number of operations of the tensor network contraction.
    """
    visitor = StabilizerCodeFlopsCostVisitor()
    contraction.contract(verbose=False, visitors=[visitor])
    print("returning cost: ", visitor.total_cost, " log2 is: ", np.log2(visitor.total_cost))
    return visitor.total_cost


class StabilizerCodeFlopsCostVisitor(ContractionVisitor):
    """A contraction visitor that calculates the cost of contracting a stabilizer code
    tensor network from the parity check matrices of the nodes."""

    def __init__(self):
        super().__init__()
        self.total_cost = 0

    def on_merge(
        self,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        new_pte: StabilizerCodeTensorEnumerator,
    ) -> None:
        prev_submatrix1 = pte1.rank()
        prev_submatrix2 = pte2.rank()

        matches = count_matching_stabilizers_ratio_all_pairs(pte1, pte2, join_legs1, join_legs2) 
        self.total_cost += (2 ** (prev_submatrix1 + prev_submatrix2)) * matches
