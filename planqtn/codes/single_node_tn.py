from typing import List, Tuple
from galois import GF2
import numpy as np
from planqtn.progress_reporter import DummyProgressReporter, ProgressReporter
from planqtn.tensor_network import (
    TensorNetwork,
    StabilizerCodeTensorEnumerator,
)


class SingleNodeTensorNetwork(TensorNetwork):
    def __init__(self, node: StabilizerCodeTensorEnumerator, truncate_length=None):
        self.node_idx = node.idx
        super().__init__([node], truncate_length)

    @property
    def node(self):
        return self.nodes[self.node_idx]

    def n_qubits(self):
        return self.node.h.shape[1] // 2

    def analyze_traces(
        self, cotengra=False, each_step=False, details=False, **cotengra_opts
    ):
        if details:
            print("Nothing to analyze in single node TN.")

    def qubit_to_node_and_leg(self, q):
        return self.node_idx, self.node.legs[q]

    def stabilizer_enumerator_polynomial(
        self,
        open_legs: List[Tuple[int, int]] = [],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        cotengra: bool = True,
    ):
        return self.node.stabilizer_enumerator_polynomial(
            open_legs=open_legs,
            verbose=verbose,
            progress_reporter=progress_reporter,
        )
