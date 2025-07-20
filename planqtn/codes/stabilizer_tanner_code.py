import numpy as np
from planqtn.tensor_network import PAULI_X, TensorNetwork
from planqtn.legos import Legos
from planqtn.tensor_network import (
    PAULI_I,
    StabilizerCodeTensorEnumerator,
)


class StabilizerTannerCodeTN(TensorNetwork):
    def __init__(self, h):
        if h.shape[1] % 2 == 1:
            raise ValueError(f"Not a symplectic matrix: {h}")

        r = h.shape[0]
        n = h.shape[1] // 2

        checks = []
        for i in range(r):
            weight = np.count_nonzero(h[i])
            check = StabilizerCodeTensorEnumerator(
                h=Legos.z_rep_code(weight + 2), tensor_id=f"check{i}"
            )
            check = check.trace_with_stopper(PAULI_X, (f"check{i}", 0))
            check = check.trace_with_stopper(PAULI_X, (f"check{i}", 1))
            checks.append(check)

        traces = []
        next_check_legs = [2] * r
        q_tensors = []

        # for each qubit we create merged tensors across all checks
        for q in range(n):
            q_tensor = StabilizerCodeTensorEnumerator(
                h=Legos.stopper_i, tensor_id=f"q{q}"
            )
            physical_leg = (f"q{q}", 0)
            for i in range(r):
                op = tuple(h[i, (q, q + n)])
                print(q_tensor.tensor_id, q, i, op, q_tensor.legs, physical_leg)
                if op == (0, 0):
                    continue

                if op == (1, 0):
                    q_tensor = q_tensor.conjoin(
                        StabilizerCodeTensorEnumerator(
                            h=Legos.x_rep_code(3), tensor_id=f"q{q}.c{i}"
                        ),
                        [physical_leg],
                        [0],
                    )
                    traces.append(
                        (
                            q_tensor.tensor_id,
                            checks[i].tensor_id,
                            [(f"q{q}.c{i}", 1)],
                            [next_check_legs[i]],
                        )
                    )
                    next_check_legs[i] += 1
                    physical_leg = (f"q{q}.c{i}", 2)

                elif op == (0, 1):
                    q_tensor = q_tensor.conjoin(
                        StabilizerCodeTensorEnumerator(
                            h=Legos.z_rep_code(3), tensor_id=f"q{q}.z{i}"
                        ),
                        [physical_leg],
                        [0],
                    )
                    q_tensor = q_tensor.conjoin(
                        StabilizerCodeTensorEnumerator(
                            h=Legos.h, tensor_id=f"q{q}.c{i}"
                        ),
                        [(f"q{q}.z{i}", 1)],
                        [0],
                    )
                    traces.append(
                        (
                            q_tensor.tensor_id,
                            checks[i].tensor_id,
                            [(f"q{q}.c{i}", 1)],
                            [next_check_legs[i]],
                        )
                    )
                    next_check_legs[i] += 1
                    physical_leg = (f"q{q}.z{i}", 2)

                else:
                    raise ValueError("Y stabilizer is not implemented yet...")
            q_tensors.append(q_tensor)

        super().__init__(nodes={n.tensor_id: n for n in q_tensors + checks})

        for t in traces:
            self.self_trace(*t)
