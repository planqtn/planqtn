"""Calculates the upper bound cost of contracting a stabilizer code tensor network."""

from typing import Dict, Set, List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


class UpperBoundCostVisitor(ContractionVisitor):
    """A contraction visitor that calculates the upper bound cost of contracting a stabilizer code
    tensor network. Uses the upper bound metric for each contraction from arXiv:2308.05152
    """

    def __init__(self, open_legs_per_node: Dict[TensorId, List[TensorLeg]]):
        super().__init__()
        self.open_legs_count = {
            node_idx: len(legs) for node_idx, legs in open_legs_per_node.items()
        }
        self.total_cost = 0

    def on_self_trace(
        self,
        trace: Trace,
        pte: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        nodes_in_pte: Set[TensorId],
    ):
        node_idx1, _, _, _ = trace
        open_legs1 = self.open_legs_count.get(node_idx1, 0)

        for node in nodes_in_pte:
            self.open_legs_count[node] = open_legs1 - 2

        open_legs1 -= 1

        exp = int(open_legs1) + int(open_legs1) + min(int(open_legs1), int(open_legs1))
        self.total_cost += 2**exp

    def on_merge(
        self,
        trace: Trace,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        merged_nodes: Set[TensorId],
    ):
        node_idx1, node_idx2, _, _ = trace
        open_legs1 = self.open_legs_count.get(node_idx1, 0)
        open_legs2 = self.open_legs_count.get(node_idx2, 0)

        for node in merged_nodes:
            self.open_legs_count[node] = open_legs1 + open_legs2 - 1

        exp = int(open_legs1) + int(open_legs2) + min(int(open_legs1), int(open_legs2))
        self.total_cost += 2**exp
