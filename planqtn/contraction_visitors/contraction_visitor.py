"""Contains the abstract class ContractionVisitor that can be passed into
conjoin_nodes of a TensorNetwork to collect various information."""

import abc
from typing import Dict, List, Set, Tuple

from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


class ContractionVisitor(abc.ABC):
    """Abstract base class for visitors that can be called during contraction."""

    def __init__(self) -> None:
        self.traceable_legs: Dict[TensorId, List[TensorLeg]] = {}

    @abc.abstractmethod
    def on_self_trace(
        self,
        trace: Trace,
        pte: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        nodes_in_pte: Set[TensorId],
    ) -> None:
        """Called when a self trace operation is performed."""

    @abc.abstractmethod
    def on_merge(
        self,
        trace: Trace,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        merged_nodes: Set[TensorId],
    ) -> None:
        """Called when two PTEs are merged."""

    def _update_traceable_legs(
        self,
        nodes_to_update: Set[TensorId],
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        current_traceable_legs: List[List[TensorLeg]],
    ) -> List[TensorLeg]:
        """Helper method to update the traceable legs after a contraction."""
        new_traceable_legs = [
            leg
            for node_legs in current_traceable_legs
            for leg in node_legs
            if leg not in join_legs1 and leg not in join_legs2
        ]

        for node in nodes_to_update:
            self.traceable_legs[node] = new_traceable_legs

        return new_traceable_legs
