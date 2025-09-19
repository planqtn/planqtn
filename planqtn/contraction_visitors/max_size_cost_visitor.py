"""Finds the maximum intermediate tensor size during the contraction of
a stabilizer code tensor network."""

from typing import List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)


Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


# pylint: disable=too-few-public-methods
class MaxTensorSizeCostVisitor(ContractionVisitor[StabilizerCodeTensorEnumerator]):
    """A contraction visitor that finds the largest intermediate tensor size
    during the contraction."""

    def __init__(self) -> None:
        super().__init__()
        self.max_size = 0

    def on_merge(
        self,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        new_pte: StabilizerCodeTensorEnumerator,
        tensor_with: bool = False,
    ) -> None:
        self.max_size = max(self.max_size, 2 ** new_pte.rank())
