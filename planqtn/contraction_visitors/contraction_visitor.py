"""Contains the abstract class ContractionVisitor that can be passed into
conjoin_nodes of a TensorNetwork to collect various information."""

import abc
from typing import List, Tuple

from planqtn.tracable import Tracable
from planqtn.tensor import TensorId, TensorLeg

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


# pylint: disable=too-few-public-methods
class ContractionVisitor[T: Tracable](abc.ABC):
    """Abstract base class for visitors that can be called during contraction."""

    @abc.abstractmethod
    def on_merge(
        self,
        pte1: T,
        pte2: T,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        new_pte: T,
        tensor_with: bool = False,
    ) -> None:
        """Called when two PTEs are merged."""
