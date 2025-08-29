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
        super().__init__()
        self.traceable_legs = dict(open_legs_per_node)
        self.max_size = 0
        self.total_cost = 0

    def _record_contraction_step(
        self,
        trace: Trace,
        new_pte: StabilizerCodeTensorEnumerator,
        nodes_to_update: Set[TensorId],
    ) -> None:
        # pylint: disable=duplicate-code
        node_idx1, node_idx2, join_legs1, join_legs2 = trace

        open_legs = [self.traceable_legs[node_idx1]]
        if node_idx1 != node_idx2:
            open_legs.append(self.traceable_legs[node_idx2])

        new_traceable_legs = self._update_traceable_legs(
            nodes_to_update,
            join_legs1,
            join_legs2,
            open_legs,
        )
        # pylint: enable=duplicate-code
        new_tensor_rank = get_rank_for_matrix_legs(new_pte, new_traceable_legs)

        new_size = 2**new_tensor_rank
        self.max_size = max(self.max_size, new_size)

    def on_self_trace(
        self,
        trace: Trace,
        pte: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        nodes_in_pte: Set[TensorId],
    ) -> None:
        self._record_contraction_step(trace, new_pte, nodes_in_pte)

    def on_merge(
        self,
        trace: Trace,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        merged_nodes: Set[TensorId],
    ) -> None:
        self._record_contraction_step(trace, new_pte, merged_nodes)
