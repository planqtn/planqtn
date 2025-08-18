"""Contains the abstract class ContractionVisitor that can be passed into
a contraction operation of a TensorNetwork."""

import abc


class ContractionVisitor(abc.ABC):
    """Abstract base class for visitors that can be called during contraction."""

    @abc.abstractmethod
    def on_self_trace(self, node_idx1, join_legs1, join_legs2, pte, nodes_in_pte):
        """Called when a self trace operation is performed."""

    @abc.abstractmethod
    def on_merge(
        self, node_idx1, node_idx2, join_legs1, join_legs2, pte1, pte2, merged_nodes
    ):
        """Called when two PTEs are merged."""
