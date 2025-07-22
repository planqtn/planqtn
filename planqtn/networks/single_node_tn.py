"""The `single_node_tn` module contains the `SingleNodeTensorNetwork` class,
which implements a tensor network consisting of a single tensor node.
"""

from typing import Any, Optional, Sequence, Tuple

import cotengra as ctg

from planqtn.progress_reporter import DummyProgressReporter, ProgressReporter
from planqtn.tensor_network import (
    StabilizerCodeTensorEnumerator,
    TensorEnumerator,
    TensorId,
    TensorLeg,
    TensorNetwork,
)


class SingleNodeTensorNetwork(TensorNetwork):
    """A tensor network consisting of a single tensor node.

    This class represents a tensor network with only one tensor node, typically
    used for simple stabilizer codes or as a building block for more complex networks.

    Args:
        node: The single tensor node to include in the network.
        truncate_length: Optional maximum weight for truncating enumerators.
    """

    def __init__(
        self,
        node: StabilizerCodeTensorEnumerator,
        truncate_length: Optional[int] = None,
    ):
        self.node_idx = node.tensor_id
        super().__init__([node], truncate_length)

    @property
    def node(self) -> StabilizerCodeTensorEnumerator:
        """Get the single tensor node in this network.

        Returns:
            StabilizerCodeTensorEnumerator: The single tensor node.
        """
        return self.nodes[self.node_idx]

    def n_qubits(self) -> int:
        """Get the total number of qubits in the tensor network.

        Returns:
            int: Total number of qubits represented by this tensor network.
        """
        return int(self.node.h.shape[1] // 2)

    def analyze_traces(
        self,
        cotengra: bool = False,
        each_step: bool = False,
        details: bool = False,
        **cotengra_opts: Any,
    ) -> Tuple[ctg.ContractionTree, int]:
        """Analyze the traces in the tensor network.

        For a single node tensor network, there are no traces to analyze.

        Args:
            cotengra: Whether to use cotengra for analysis.
            each_step: Whether to analyze each step.
            details: Whether to print detailed information.
            **cotengra_opts: Additional options for cotengra.

        Returns:
            A tuple of (contraction_tree, cost) where both are None/0 for single node.
        """
        if details:
            print("Nothing to analyze in single node TN.")

        return None, 0

    def qubit_to_node_and_leg(self, q: int) -> Tuple[TensorId, TensorLeg]:
        return self.node_idx, self.node.legs[q]

    def stabilizer_enumerator_polynomial(
        self,
        open_legs: Sequence[TensorLeg] = (),
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        cotengra: bool = True,
    ) -> TensorEnumerator:
        return self.node.stabilizer_enumerator_polynomial(
            open_legs=open_legs,
            verbose=verbose,
            progress_reporter=progress_reporter,
        )
