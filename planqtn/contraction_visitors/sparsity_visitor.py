"""Finds the sparsity of the tensors throughout the contraction."""

from typing import Dict, Set, List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.linalg import rank
from planqtn.contraction_visitors.stabilizer_code_cost_fn import get_rank_for_matrix_legs
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
        self.traceable_legs = dict(open_legs_per_node)
        self.tensor_sparsity = []

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

        new_tensor_rank = get_rank_for_matrix_legs(
            new_pte, new_traceable_legs
        )

        dense_size = 4**len(new_traceable_legs)
        self.tensor_sparsity.append(
            (2**new_tensor_rank) / dense_size
        )

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

        new_tensor_rank = get_rank_for_matrix_legs(
            new_pte, new_traceable_legs
        )

        dense_size = 4**len(new_traceable_legs)
        self.tensor_sparsity.append(
            (2**new_tensor_rank) / dense_size
        )

