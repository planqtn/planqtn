"""Finds the sparsity of the tensors throughout the contraction."""

from typing import Dict, Set, List, Tuple

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)


Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


class SparsityVisitor(ContractionVisitor):
    """A contraction visitor that calculates the sparsity of the tensors
    throughout the contraction of a stabilizer code tensor network."""

    def __init__(self):
        super().__init__()
        self.tensor_sparsity: List[float] = []

    def on_merge(
        self,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        new_pte: StabilizerCodeTensorEnumerator,
    ) -> None:
        dense_size = 4 ** len(new_pte.open_legs)
        self.tensor_sparsity.append((2 ** new_pte.rank()) / dense_size)
