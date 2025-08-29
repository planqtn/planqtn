"""Calculates the cost of contracting a stabilizer code tensor network
based only on the parity check matrix."""

from typing import TYPE_CHECKING, Dict, Set, List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.symplectic import count_matching_stabilizers_ratio
from planqtn.parity_check import tensor_product
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

if TYPE_CHECKING:
    from ..tensor_network import TensorNetwork

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


def custom_flops_cost_stabilizer_codes(tn: "TensorNetwork") -> int:
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
    tn.conjoin_nodes(verbose=False, visitors=[visitor])
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

        # Get the columns of the parity check matrix corresponding to the join legs
        join_idxs = pte1.get_col_indices(set(join_legs1))
        join_idxs2 = pte2.get_col_indices(set(join_legs2))
        open_cols_matrix1 = pte1.h[:, join_idxs]
        open_cols_matrix2 = pte2.h[:, join_idxs2]

        tensor_prod = tensor_product(open_cols_matrix1, open_cols_matrix2)
        matches = count_matching_stabilizers_ratio(tensor_prod)
        self.total_cost += (2 ** (prev_submatrix1 + prev_submatrix2)) * matches
