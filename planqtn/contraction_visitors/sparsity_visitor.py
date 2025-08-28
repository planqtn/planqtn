"""Finds the sparsity of the tensors throughout the contraction."""

from typing import Dict, Set, List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.contraction_visitors.utils import get_rank_for_matrix_legs
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)


Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


class SparsityVisitor(ContractionVisitor):
    """A contraction visitor that calculates the sparsity of the tensors
    throughout the contraction of a stabilizer code tensor network."""

    def __init__(self, open_legs_per_node: Dict[TensorId, List[TensorLeg]]):
        super().__init__()
        self.traceable_legs = dict(open_legs_per_node)
        self.tensor_sparsity = []

    def _record_contraction_step(
        self,
        trace: Trace,
        new_pte: StabilizerCodeTensorEnumerator,
        nodes_to_update: Set[TensorId],
    ):  # pylint: disable=duplicate-code
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

        new_tensor_rank = get_rank_for_matrix_legs(new_pte, new_traceable_legs)

        dense_size = 4 ** len(new_traceable_legs)
        self.tensor_sparsity.append((2**new_tensor_rank) / dense_size)

    def on_self_trace(
        self,
        trace: Trace,
        pte: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        nodes_in_pte: Set[TensorId],
    ):
        self._record_contraction_step(trace, new_pte, nodes_in_pte)

    def on_merge(
        self,
        trace: Trace,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        merged_nodes: Set[TensorId],
    ):
        self._record_contraction_step(trace, new_pte, merged_nodes)
