import numpy as np
from planqtn.tensor_network import TensorNetwork, Trace
from planqtn.legos import LegoAnnotation, Legos
from planqtn.tensor_network import (
    PAULI_I,
    StabilizerCodeTensorEnumerator,
)
from typing import Optional, List
from galois import GF2
from planqtn.legos import LegoType


class CssTannerCodeTN(TensorNetwork):
    def __init__(
        self,
        hx: np.ndarray,
        hz: np.ndarray,
        coset_error: Optional[GF2] = None,
        truncate_length: Optional[int] = None,
    ):
        rx, n = hx.shape
        rz = hz.shape[0]

        q_tensors: List[StabilizerCodeTensorEnumerator] = []
        traces: List[Trace] = []

        for q in range(n):
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
                annotation=LegoAnnotation(type=LegoType.ZREP, short_name=f"z{q}"),
            )

            # leg numbering for the spiders: 0 for logical, 1 for physical,
            # rest is to the check nodes
            # going left to right:
            # I -> h0 -> Z [leg0  (legs to Z check 2...n_z_legs) leg1] -> h1 -> X[leg0  (legs to X check 2...n_x_legs) -> dangling physical leg 1] -> x
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

        q_legs = [2] * n
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
                traces.append(
                    (
                        g_tensor.tensor_id,
                        x.tensor_id,
                        [(g_tensor.tensor_id, g_leg)],
                        [(x.tensor_id, q_legs[q])],
                    )
                )
                q_legs[q] += 1
        gz_tensors = []
        q_legs = [2] * n

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
