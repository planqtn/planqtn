"""Contains the abstract class ContractionVisitor that can be passed into
a contraction operation of a TensorNetwork."""

import abc
from typing import List, Set, Tuple

from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator, TensorId, TensorLeg

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]

class ContractionVisitor(abc.ABC):
    """Abstract base class for visitors that can be called during contraction."""

    @abc.abstractmethod
    def on_self_trace(self, trace: Trace, pte: StabilizerCodeTensorEnumerator, nodes_in_pte: Set[TensorId]):
        """Called when a self trace operation is performed."""

    @abc.abstractmethod
    def on_merge(
        self, trace: Trace, pte1: StabilizerCodeTensorEnumerator, pte2: StabilizerCodeTensorEnumerator, merged_nodes: Set[TensorId]
    ):
        """Called when two PTEs are merged."""
