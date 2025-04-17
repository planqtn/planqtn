import numpy as np
from qlego.tensor_network import TensorNetwork
from qlego.legos import LegoAnnotation, Legos
from qlego.tensor_network import (
    PAULI_I,
    StabilizerCodeTensorEnumerator,
)


class CssTannerCodeTN(TensorNetwork):
    def __init__(self, hx, hz):
        rx, n = hx.shape
        rz = hz.shape[0]

        q_tensors = []
        traces = []

        for q in range(n):
            x_stabs = np.nonzero(hx[:, q])[0]
            n_x_legs = len(x_stabs)
            z_stabs = np.nonzero(hz[:, q])[0]
            n_z_legs = len(z_stabs)

            h0 = StabilizerCodeTensorEnumerator(
                Legos.h,
                idx=f"q{q}.h0",
                annotation=LegoAnnotation(type="h", shortName=f"h0{q}"),
            )
            h1 = StabilizerCodeTensorEnumerator(
                Legos.h,
                idx=f"q{q}.h1",
                annotation=LegoAnnotation(type="h", shortName=f"h1{q}"),
            )

            x = StabilizerCodeTensorEnumerator(
                Legos.x_rep_code(2 + n_x_legs),
                idx=f"q{q}.x",
                annotation=LegoAnnotation(type="x_rep_code", shortName=f"x{q}"),
            )

            z = StabilizerCodeTensorEnumerator(
                Legos.x_rep_code(2 + n_z_legs),
                idx=f"q{q}.z",
                annotation=LegoAnnotation(type="x_rep_code", shortName=f"z{q}"),
            )

            # leg numbering for the spiders: 0 for logical, 1 for physical,
            # rest is to the check nodes
            # going left to right:
            # I -> h0 -> Z [leg0  (legs to Z check 2...n_z_legs) leg1] -> h1 -> X[leg0  (legs to X check 2...n_x_legs) -> dangling physical leg 1] -> x
            i_stopper = StabilizerCodeTensorEnumerator(
                Legos.stopper_i,
                idx=f"q{q}.id",
                annotation=LegoAnnotation(type="stopper_i", shortName=f"id{q}"),
            )
            q_tensors.append(i_stopper)
            q_tensors.append(h0)
            q_tensors.append(z)
            q_tensors.append(h1)
            q_tensors.append(x)

            traces.append(
                (
                    i_stopper.idx,
                    h0.idx,
                    [(f"q{q}.id", 0)],
                    [(f"q{q}.h0", 0)],
                )
            )
            traces.append(
                (
                    h0.idx,
                    z.idx,
                    [1],
                    [(f"q{q}.z", 0)],
                )
            )
            traces.append(
                (
                    h1.idx,
                    z.idx,
                    [0],
                    [(f"q{q}.z", 1)],
                )
            )
            traces.append(
                (
                    h1.idx,
                    x.idx,
                    [(f"q{q}.h1", 1)],
                    [(f"q{q}.x", 0)],
                )
            )

        q_legs = [2] * n
        gx_tensors = []
        for i, gx in enumerate(hx):
            qs = np.nonzero(gx)[0]
            g_tensor = StabilizerCodeTensorEnumerator(
                Legos.z_rep_code(len(qs)),
                f"x{i}",
                annotation=LegoAnnotation(
                    type="z_rep_code",
                    shortName=f"x{i}",
                ),
            )
            # print(f"=== x tensor {g_tensor.idx} -> {qs} === ")

            gx_tensors.append(g_tensor)
            for g_leg, q in enumerate(qs):
                traces.append(
                    (
                        g_tensor.idx,
                        f"q{q}.x",
                        [g_leg],
                        [(f"q{q}.x", q_legs[q])],
                    )
                )
                q_legs[q] += 1
        gz_tensors = []
        q_legs = [2] * n

        for i, gz in enumerate(hz):
            qs = np.nonzero(gz)[0]
            g_tensor = StabilizerCodeTensorEnumerator(
                Legos.z_rep_code(len(qs)),
                f"z{i}",
                annotation=LegoAnnotation(
                    type="z_rep_code",
                    shortName=f"z{i}",
                ),
            )
            gz_tensors.append(g_tensor)
            for g_leg, q in enumerate(qs):
                traces.append(
                    (
                        g_tensor.idx,
                        f"q{q}.z",
                        [g_leg],
                        [(f"q{q}.z", q_legs[q])],
                    )
                )
                q_legs[q] += 1
        super().__init__(q_tensors + gx_tensors + gz_tensors)

        for t in traces:
            self.self_trace(*t)
