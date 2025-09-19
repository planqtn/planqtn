"""Calculates the cost of contracting a stabilizer code tensor network
based only on the parity check matrix."""

from typing import List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.symplectic import count_matching_stabilizers_ratio_all_pairs
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)


Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


# pylint: disable=too-few-public-methods
class StabilizerCodeFlopsCostVisitor(
    ContractionVisitor[StabilizerCodeTensorEnumerator]
):
    """A contraction visitor that calculates the cost of contracting a stabilizer code
    tensor network from the parity check matrices of the nodes."""

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
        prev_submatrix1 = pte1.rank()
        prev_submatrix2 = pte2.rank()

        if (
            not join_legs1 and not join_legs2
        ) or tensor_with:  # If no legs to join, just tensor product so go over all keys
            matches = 1.0
        else:
            matches = count_matching_stabilizers_ratio_all_pairs(
                pte1, pte2, join_legs1, join_legs2
            )

        self.total_cost += (2 ** (prev_submatrix1 + prev_submatrix2)) * matches
