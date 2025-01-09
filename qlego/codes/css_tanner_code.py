import numpy as np
from qlego.tensor_stabilizer_enumerator import TensorNetwork
from tnqec.qlego.legos import Legos
from tnqec.qlego.tensor_stabilizer_enumerator import (
    PAULI_I,
    TensorStabilizerCodeEnumerator,
)


class CssTannerCode(TensorNetwork):
    def __init__(self, hx, hz):
        rx, n = hx.shape
        rz = hz.shape[0]

        q_tensors = []

        for q in range(n):
            x_stabs = np.nonzero(hx[:, q])[0]
            n_x_legs = len(x_stabs)
            z_stabs = np.nonzero(hz[:, q])[0]
            n_z_legs = len(z_stabs)
            # print(q, x_stabs, z_stabs)
            h0 = TensorStabilizerCodeEnumerator(Legos.h, idx=f"q{q}.h0")
            h1 = TensorStabilizerCodeEnumerator(Legos.h, idx=f"q{q}.h1")

            x = TensorStabilizerCodeEnumerator(
                Legos.x_rep_code(2 + n_x_legs), idx=f"q{q}.x"
            )
            z = TensorStabilizerCodeEnumerator(
                Legos.x_rep_code(2 + n_z_legs), idx=f"q{q}.z"
            )
            # leg numbering for the spiders: 0 for logical, 1 for physical,
            # rest is to the check nodes
            q_tensor = (
                h0.conjoin(z, [1], [0])
                .conjoin(h1, [(f"q{q}.z", 1)], [0])
                .conjoin(x, [(f"q{q}.h1", 1)], [0])
            )

            q_tensor.set_idx(f"q{q}")
            q_tensor = q_tensor.trace_with_stopper(PAULI_I, (f"q{q}", 0))
            q_tensors.append(q_tensor)
            # print(q_tensor.legs)
        traces = []

        q_legs = [2] * n
        gx_tensors = []
        for i, gx in enumerate(hx):
            qs = np.nonzero(gx)[0]
            g_tensor = TensorStabilizerCodeEnumerator(
                Legos.z_rep_code(len(qs)), f"x{i}"
            )
            # print(f"=== x tensor {g_tensor.idx} -> {qs} === ")

            gx_tensors.append(g_tensor)
            for g_leg, q in enumerate(qs):
                traces.append(
                    (
                        g_tensor.idx,
                        q_tensors[q].idx,
                        [g_leg],
                        [(f"q{q}.x", q_legs[q])],
                    )
                )
                q_legs[q] += 1
        gz_tensors = []
        q_legs = [2] * n

        for i, gz in enumerate(hz):
            qs = np.nonzero(gz)[0]
            g_tensor = TensorStabilizerCodeEnumerator(
                Legos.z_rep_code(len(qs)), f"z{i}"
            )
            gz_tensors.append(g_tensor)
            for g_leg, q in enumerate(qs):
                traces.append(
                    (
                        g_tensor.idx,
                        q_tensors[q].idx,
                        [g_leg],
                        [(f"q{q}.z", q_legs[q])],
                    )
                )
                q_legs[q] += 1
        super().__init__(q_tensors + gx_tensors + gz_tensors)

        for t in traces:
            self.self_trace(*t)
