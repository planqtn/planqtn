"""Finds the maximum intermediate tensor size during the contraction of
a stabilizer code tensor network."""

from typing import TYPE_CHECKING, Dict, Set, List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.contraction_visitors.utils import get_rank_for_matrix_legs
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

if TYPE_CHECKING:
    from planqtn.tensor_network import TensorNetwork

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


def max_tensor_size_cost(
    tn: "TensorNetwork", open_legs_per_node: Dict[TensorId, List[TensorLeg]]
) -> int:
    """This function uses the MaxTensorSizeCostVisitor to compute the maximum intermediate
    tensor size during a stabilizer code tensor network contraction.

    Args:
        tn (TensorNetwork): The tensor network to analyze.
        open_legs_per_node (dict): A dictionary mapping node indices to lists of open legs.

    Returns:
        int: The largest intermediate tensor size during the contraction.
    """
    visitor = MaxTensorSizeCostVisitor(open_legs_per_node)
    tn.conjoin_nodes(verbose=False, visitors=[visitor])
    return visitor.max_size


class MaxTensorSizeCostVisitor(ContractionVisitor):
    """A contraction visitor that finds the largest intermediate tensor size
    during the contraction."""

    def __init__(self, open_legs_per_node: Dict[TensorId, List[TensorLeg]]):
        self.traceable_legs = dict(open_legs_per_node)
        self.max_size = 0
        self.total_cost = 0

    def on_self_trace(
        self,
        trace: Trace,
        pte: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        nodes_in_pte: Set[TensorId],
    ):
        node_idx1, node_idx2, join_legs1, join_legs2 = trace
        # Removing joined legs from traced pte
        new_traceable_legs = [
            leg
            for leg in self.traceable_legs[node_idx1]
            if leg not in join_legs1 and leg not in join_legs2
        ]

        for node in nodes_in_pte:
            self.traceable_legs[node] = new_traceable_legs

        new_tensor_rank = get_rank_for_matrix_legs(new_pte, new_traceable_legs)

        new_size = 2**new_tensor_rank
        self.max_size = max(self.max_size, new_size)

    def on_merge(
        self,
        trace: Trace,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        merged_nodes: Set[TensorId],
    ):
        node_idx1, node_idx2, join_legs1, join_legs2 = trace

        # Merge open legs and remove the join legs for merged pte
        new_traceable_legs = [
            leg
            for node_legs in (
                self.traceable_legs[node_idx1],
                self.traceable_legs[node_idx2],
            )
            for leg in node_legs
            if leg not in join_legs1 and leg not in join_legs2
        ]

        for node in merged_nodes:
            self.traceable_legs[node] = new_traceable_legs

        new_tensor_rank = get_rank_for_matrix_legs(new_pte, new_traceable_legs)

        new_size = 2**new_tensor_rank
        self.max_size = max(self.max_size, new_size)
