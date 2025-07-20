from typing import Optional, Tuple, Any, Sequence
from planqtn.progress_reporter import DummyProgressReporter, ProgressReporter
from planqtn.tensor_network import (
    TensorNetwork,
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
    TensorEnumerator,
)
import cotengra as ctg


class SingleNodeTensorNetwork(TensorNetwork):
    def __init__(
        self,
        node: StabilizerCodeTensorEnumerator,
        truncate_length: Optional[int] = None,
    ):
        self.node_idx = node.tensor_id
        super().__init__([node], truncate_length)

    @property
    def node(self) -> StabilizerCodeTensorEnumerator:
        return self.nodes[self.node_idx]

    def n_qubits(self) -> int:
        return int(self.node.h.shape[1] // 2)

    def analyze_traces(
        self,
        cotengra: bool = False,
        each_step: bool = False,
        details: bool = False,
        **cotengra_opts: Any,
    ) -> Tuple[ctg.ContractionTree, int]:
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
