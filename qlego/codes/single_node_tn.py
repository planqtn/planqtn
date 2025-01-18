from galois import GF2
import numpy as np
from qlego.tensor_stabilizer_enumerator import (
    TensorNetwork,
    TensorStabilizerCodeEnumerator,
)


class SingleNodeTensorNetwork(TensorNetwork):
    def __init__(self, node: TensorStabilizerCodeEnumerator, truncate_length=None):
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
        legs=[],
        e=None,
        eprime=None,
        verbose=False,
        progress_bar=False,
        summed_legs=None,
        cotengra=True,
    ):
        return self.node.stabilizer_enumerator_polynomial(
            basis_element_legs=legs, e=e, eprime=eprime, open_legs=[]
        )
