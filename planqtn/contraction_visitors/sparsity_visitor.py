"""Finds the sparsity of the tensors throughout the contraction."""

from typing import List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)


Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


# pylint: disable=too-few-public-methods
class SparsityVisitor(ContractionVisitor[StabilizerCodeTensorEnumerator]):
    """A contraction visitor that calculates the sparsity of the tensors
    throughout the contraction of a stabilizer code tensor network."""

    def __init__(self) -> None:
        super().__init__()
        self.tensor_sparsity: List[Tuple[int, int, int, float]] = []

    def on_merge(
        self,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        new_pte: StabilizerCodeTensorEnumerator,
        tensor_with: bool = False,
    ) -> None:

        if tensor_with is False:
            dense_size = 4 ** len(new_pte.open_legs)
            new_size = 2 ** new_pte.rank()
            self.tensor_sparsity.append(
                (len(new_pte.open_legs), new_size, dense_size, new_size / dense_size)
            )
