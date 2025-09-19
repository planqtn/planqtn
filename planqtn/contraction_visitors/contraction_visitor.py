"""Contains the abstract class ContractionVisitor that can be passed into
conjoin_nodes of a TensorNetwork to collect various information."""

import abc
from typing import List, Tuple

from planqtn.stabilizer_tensor_enumerator import (
    TensorId,
    TensorLeg,
)
from planqtn.tracable import Tracable

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


class ContractionVisitor[TensorType: Tracable](abc.ABC):
    """Abstract base class for visitors that can be called during contraction."""

    @abc.abstractmethod
    def on_merge(
        self,
        pte1: TensorType,
        pte2: TensorType,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        new_pte: TensorType,
        tensor_with: bool = False,
    ) -> None:
        """Called when two PTEs are merged."""
