"""Calculates the cost of contracting a stabilizer code tensor network
based only on the parity check matrix."""

from typing import TYPE_CHECKING, Dict, Set, List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.contraction_visitors.utils import (
    count_matching_stabilizers_ratio,
    get_col_indices,
    get_rank_for_matrix_legs,
)
from planqtn.parity_check import tensor_product
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

if TYPE_CHECKING:
    from ..tensor_network import TensorNetwork

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


def custom_flops_cost_stabilizer_codes(
    tn: "TensorNetwork", open_legs_per_node: Dict[TensorId, List[TensorLeg]]
) -> int:
    """This function uses the StabilizerCodeCostVisitor to compute the total cost of a stabilizer
    code tensor network contraction. The visitor calculates the cost of a contraction step during
    the conjoining of nodes in the tensor network.

    Args:
        tn (TensorNetwork): The tensor network to analyze.
        open_legs_per_node (dict): A dictionary mapping node indices to lists of open legs.

    Returns:
        int: The total number of operations of the tensor network contraction.
    """
    visitor = StabilizerCodeFlopsCostVisitor(open_legs_per_node)
    tn.conjoin_nodes(verbose=False, visitors=[visitor])
    return visitor.total_cost


class StabilizerCodeFlopsCostVisitor(ContractionVisitor):
    """A contraction visitor that calculates the cost of contracting a stabilizer code
    tensor network from the parity check matrices of the nodes."""

    def __init__(self, open_legs_per_node: Dict[TensorId, List[TensorLeg]]):
        super().__init__()
        self.traceable_legs = dict(open_legs_per_node)
        self.total_cost = 0

    def on_self_trace(
        self,
        trace: Trace,
        pte: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        nodes_in_pte: Set[TensorId],
    ):
        node_idx1, _, join_legs1, join_legs2 = trace

        new_traceable_legs = self._update_traceable_legs(
            nodes_in_pte,
            join_legs1,
            join_legs2,
            [self.traceable_legs[node_idx1]],
        )

        prev_rank_submatrix = get_rank_for_matrix_legs(
            pte, new_traceable_legs + join_legs1 + join_legs2
        )

        # Get the columns of the parity check matrix corresponding to the join legs
        join_idxs = get_col_indices(pte, join_legs1)
        join_idxs2 = get_col_indices(pte, join_legs2)
        open_cols_matrix = pte.h[
            :, [join_idxs[0], join_idxs2[0], join_idxs[1], join_idxs2[1]]
        ]

        matches = count_matching_stabilizers_ratio(open_cols_matrix)
        self.total_cost += (2 ** (prev_rank_submatrix)) * matches

    def on_merge(
        self,
        trace: Trace,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        merged_nodes: Set[TensorId],
    ):
        node_idx1, node_idx2, join_legs1, join_legs2 = trace
        prev_submatrix1 = get_rank_for_matrix_legs(pte1, self.traceable_legs[node_idx1])
        prev_submatrix2 = get_rank_for_matrix_legs(pte2, self.traceable_legs[node_idx2])

        # Get the columns of the parity check matrix corresponding to the join legs
        join_idxs = get_col_indices(pte1, join_legs1)
        join_idxs2 = get_col_indices(pte2, join_legs2)
        open_cols_matrix1 = pte1.h[:, join_idxs]
        open_cols_matrix2 = pte2.h[:, join_idxs2]

        tensor_prod = tensor_product(open_cols_matrix1, open_cols_matrix2)
        matches = count_matching_stabilizers_ratio(tensor_prod)
        self.total_cost += (2 ** (prev_submatrix1 + prev_submatrix2)) * matches

        self._update_traceable_legs(
            merged_nodes,
            join_legs1,
            join_legs2,
            [self.traceable_legs[node_idx1], self.traceable_legs[node_idx2]],
        )
