"""The `css_tanner_code` module.

It contains the `CssTannerCodeTN` class, which implements a tensor network
representation of CSS codes using Tanner graph structure based on Fig 6 of the following work:

Cao, ChunJun, Michael J. Gullans, Brad Lackey, and Zitao Wang. 2024.
“Quantum Lego Expansion Pack: Enumerators from Tensor Networks.”
PRX Quantum 5 (3): 030313. https://doi.org/10.1103/PRXQuantum.5.030313.
"""

from typing import List, Tuple
import numpy as np
from planqtn.tensor_network import TensorNetwork, Trace, TensorId, TensorLeg
from planqtn.legos import LegoAnnotation, Legos
from planqtn.tensor_network import (
    StabilizerCodeTensorEnumerator,
)
from planqtn.legos import LegoType


class CssTannerCodeTN(TensorNetwork):
    """A tensor network representation of CSS codes using Tanner graph structure.

    This class constructs a tensor network from X and Z parity check matrices (Hx and Hz),
    representing a CSS code. The tensor network connects qubit tensors to check tensors
    according to the non-zero entries in the parity check matrices.
    """

    def __init__(
        self,
        hx: np.ndarray,
        hz: np.ndarray,
    ):
        """Construct a CSS code tensor network from X and Z parity check matrices.

        Args:
            hx: X-type parity check matrix.
            hz: Z-type parity check matrix.
        """
        self.n: int = hx.shape[1]
        self.r: int = hz.shape[0]  # rz, but not used

        q_tensors: List[StabilizerCodeTensorEnumerator] = []
        traces: List[Trace] = []
        self.q_to_leg_and_node: List[Tuple[TensorId, TensorLeg]] = []

        for q in range(self.n):
            x_stabs = np.nonzero(hx[:, q])[0]
            n_x_legs = len(x_stabs)
            z_stabs = np.nonzero(hz[:, q])[0]
            n_z_legs = len(z_stabs)

            h0 = StabilizerCodeTensorEnumerator(
                Legos.h,
                tensor_id=f"q{q}.h0",
                annotation=LegoAnnotation(type=LegoType.H, short_name=f"h0{q}"),
            )
            h1 = StabilizerCodeTensorEnumerator(
                Legos.h,
                tensor_id=f"q{q}.h1",
                annotation=LegoAnnotation(type=LegoType.H, short_name=f"h1{q}"),
            )

            x = StabilizerCodeTensorEnumerator(
                Legos.x_rep_code(2 + n_x_legs),
                tensor_id=f"q{q}.x",
                annotation=LegoAnnotation(type=LegoType.XREP, short_name=f"x{q}"),
            )

            z = StabilizerCodeTensorEnumerator(
                Legos.x_rep_code(2 + n_z_legs),
                tensor_id=f"q{q}.z",
                annotation=LegoAnnotation(type=LegoType.XREP, short_name=f"z{q}"),
            )

            # leg numbering for the spiders: 0 for logical, 1 for physical,
            # rest is to the check nodes
            # going left to right:
            # I -> h0 -> Z [leg0  (legs to Z check 2...n_z_legs) leg1] -> h1 ->
            # X[leg0  (legs to X check 2...n_x_legs) -> dangling physical leg 1] -> x
            i_stopper = StabilizerCodeTensorEnumerator(
                Legos.stopper_i,
                tensor_id=f"q{q}.id",
                annotation=LegoAnnotation(type=LegoType.STOPPER_I, short_name=f"id{q}"),
            )
            q_tensors.append(i_stopper)
            q_tensors.append(h0)
            q_tensors.append(z)
            q_tensors.append(h1)
            q_tensors.append(x)

            traces.append(
                (
                    i_stopper.tensor_id,
                    h0.tensor_id,
                    [(f"q{q}.id", 0)],
                    [(f"q{q}.h0", 0)],
                )
            )
            traces.append(
                (
                    h0.tensor_id,
                    z.tensor_id,
                    [(h0.tensor_id, 1)],
                    [(z.tensor_id, 0)],
                )
            )
            traces.append(
                (
                    h1.tensor_id,
                    z.tensor_id,
                    [(h1.tensor_id, 0)],
                    [(z.tensor_id, 1)],
                )
            )
            traces.append(
                (
                    h1.tensor_id,
                    x.tensor_id,
                    [(h1.tensor_id, 1)],
                    [(x.tensor_id, 0)],
                )
            )

        q_legs = [2] * self.n
        gx_tensors = []
        for i, gx in enumerate(hx):
            qs = np.nonzero(gx)[0].astype(int)
            g_tensor = StabilizerCodeTensorEnumerator(
                Legos.z_rep_code(len(qs)),
                f"x{i}",
                annotation=LegoAnnotation(
                    type=LegoType.ZREP,
                    short_name=f"x{i}",
                ),
            )
            # print(f"=== x tensor {g_tensor.idx} -> {qs} === ")

            gx_tensors.append(g_tensor)
            for g_leg, q in enumerate(qs):
                x_tensor_id = f"q{q}.x"
                traces.append(
                    (
                        g_tensor.tensor_id,
                        x_tensor_id,
                        [(g_tensor.tensor_id, g_leg)],
                        [(x_tensor_id, q_legs[q])],
                    )
                )
                q_legs[q] += 1
        gz_tensors = []
        q_legs = [2] * self.n

        for i, gz in enumerate(hz):
            qs = np.nonzero(gz)[0].astype(int)
            g_tensor = StabilizerCodeTensorEnumerator(
                Legos.z_rep_code(len(qs)),
                f"z{i}",
                annotation=LegoAnnotation(
                    type=LegoType.ZREP,
                    short_name=f"z{i}",
                ),
            )
            gz_tensors.append(g_tensor)
            for g_leg, q in enumerate(qs):
                z_tensor_id = f"q{q}.z"
                traces.append(
                    (
                        g_tensor.tensor_id,
                        z_tensor_id,
                        [(g_tensor.tensor_id, g_leg)],
                        [(z_tensor_id, q_legs[q])],
                    )
                )
                q_legs[q] += 1
        super().__init__(q_tensors + gx_tensors + gz_tensors)

        for t in traces:
            self.self_trace(*t)

    def n_qubits(self) -> int:
        """Get the total number of qubits in the tensor network.

        Returns:
            int: Total number of qubits represented by this tensor network.
        """
        return self.n

    def qubit_to_node_and_leg(self, q: int) -> Tuple[TensorId, TensorLeg]:
        """Map a qubit index to its corresponding node and leg.

        Args:
            q: Global qubit index.

        Returns:
            Tuple[TensorId, TensorLeg]: Node ID and leg that represent the qubit.
        """
        return f"q{q}.x", (f"q{q}.x", 1)
