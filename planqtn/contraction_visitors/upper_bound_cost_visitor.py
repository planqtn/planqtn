"""Calculates the upper bound cost of contracting a stabilizer code tensor network."""

from typing import List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


class UpperBoundCostVisitor(ContractionVisitor[StabilizerCodeTensorEnumerator]):
    """A contraction visitor that calculates the upper bound cost of contracting a stabilizer code
    tensor network. Uses the upper bound metric for each contraction from arXiv:2308.05152
    """

    def __init__(self) -> None:
        super().__init__()
        self.total_cost = 0

    def on_merge(
        self,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        new_pte: StabilizerCodeTensorEnumerator,
        tensor_with: bool = False,
    ) -> None:
        open_legs1 = len(pte1.open_legs)
        open_legs2 = len(pte2.open_legs)

        exp = int(open_legs1) + int(open_legs2) + min(int(open_legs1), int(open_legs2))
        self.total_cost += 2**exp
