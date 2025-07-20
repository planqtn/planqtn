import numpy as np
from planqtn.tensor_network import TensorNetwork
from planqtn.legos import LegoAnnotation, LegoType, Legos
from planqtn.tensor_network import (
    StabilizerCodeTensorEnumerator,
)


class StabilizerMeasurementStatePrepTN(TensorNetwork):
    def __init__(self, parity_check_matrix: np.ndarray):
        if parity_check_matrix.shape[1] % 2 == 1:
            raise ValueError(f"Not a symplectic matrix: {parity_check_matrix}")

        r = parity_check_matrix.shape[0]
        n = parity_check_matrix.shape[1] // 2
        traces = []

        checks = []
        check_stoppers = []
        for i in range(r):
            weight = np.count_nonzero(parity_check_matrix[i])
            check = StabilizerCodeTensorEnumerator(
                h=Legos.z_rep_code(weight + 2),
                tensor_id=f"check{i}",
                annotation=LegoAnnotation(
                    type=LegoType.ZREP,
                    description="check{i}",
                    name=f"check{i}",
                    x=1 + i,
                    y=0,
                ),
            )
            x_state_prep = StabilizerCodeTensorEnumerator(
                h=Legos.stopper_x,
                tensor_id=f"x_state_prep{i}",
                annotation=LegoAnnotation(
                    type=LegoType.STOPPER_X,
                    description="xsp{i}",
                    name=f"xsp{i}",
                    x=1 + i - 0.25,
                    y=0,
                ),
            )
            check_stoppers.append(x_state_prep)
            x_meas = StabilizerCodeTensorEnumerator(
                h=Legos.stopper_x,
                tensor_id=f"x_meas{i}",
                annotation=LegoAnnotation(
                    type=LegoType.STOPPER_X,
                    description=f"xmeas{i}",
                    name=f"xmeas{i}",
                    x=1 + i + 0.25,
                    y=0,
                ),
            )
            check_stoppers.append(x_meas)

            traces.append(
                (
                    x_state_prep.tensor_id,
                    check.tensor_id,
                    [(x_state_prep.tensor_id, 0)],
                    [(check.tensor_id, 0)],
                )
            )
            traces.append(
                (
                    x_meas.tensor_id,
                    check.tensor_id,
                    [(x_meas.tensor_id, 0)],
                    [(check.tensor_id, 1)],
                )
            )
            checks.append(check)

        next_check_legs = [2] * r
        q_tensors = []
        op_tensors = []

        # for each qubit we create merged tensors across all checks
        for q in range(n):
            q_logical_id = StabilizerCodeTensorEnumerator(
                h=Legos.stopper_i,
                tensor_id=f"ql{q}",
                annotation=LegoAnnotation(
                    type=LegoType.STOPPER_I,
                    description="stopper_i",
                    name=f"stopper_i{q}",
                    x=0,
                    y=1 + q,
                ),
            )
            q_tensors.append(q_logical_id)
            physical_leg = (q_logical_id.tensor_id, (q_logical_id.tensor_id, 0))
            for i in range(r):
                op = tuple(parity_check_matrix[i, (q, q + n)])

                if op == (0, 0):
                    continue

                if op == (1, 0):
                    x_check = StabilizerCodeTensorEnumerator(
                        h=Legos.x_rep_code(3),
                        tensor_id=f"q{q}.x{i}",
                        annotation=LegoAnnotation(
                            type=LegoType.XREP,
                            description="x",
                            name=f"x{q}.{i}",
                            x=1 + i,
                            y=1 + q,
                        ),
                    )
                    op_tensors.append(x_check)

                    traces.append(
                        (
                            physical_leg[0],
                            x_check.tensor_id,
                            [physical_leg[1]],
                            [(x_check.tensor_id, 0)],
                        )
                    )

                    traces.append(
                        (
                            x_check.tensor_id,
                            checks[i].tensor_id,
                            [(x_check.tensor_id, 1)],
                            [(checks[i].tensor_id, next_check_legs[i])],
                        )
                    )
                    next_check_legs[i] += 1
                    physical_leg = (x_check.tensor_id, (x_check.tensor_id, 2))

                elif op == (0, 1):
                    z_check = StabilizerCodeTensorEnumerator(
                        h=Legos.z_rep_code(3),
                        tensor_id=f"q{q}.z{i}",
                        annotation=LegoAnnotation(
                            type=LegoType.ZREP,
                            description="z",
                            name=f"z{q}.{i}",
                            x=1 + i,
                            y=1 + q,
                        ),
                    )
                    op_tensors.append(z_check)

                    traces.append(
                        (
                            physical_leg[0],
                            z_check.tensor_id,
                            [physical_leg[1]],
                            [(z_check.tensor_id, 0)],
                        )
                    )
                    h = StabilizerCodeTensorEnumerator(
                        h=Legos.h,
                        tensor_id=f"q{q}.hz{i}",
                        annotation=LegoAnnotation(
                            type=LegoType.H,
                            description="h",
                            name=f"h{q}.{i}",
                            x=1 + i,
                            y=1 + q - 0.5,
                        ),
                    )
                    op_tensors.append(h)

                    traces.append(
                        (
                            z_check.tensor_id,
                            h.tensor_id,
                            [(z_check.tensor_id, 1)],
                            [(h.tensor_id, 0)],
                        )
                    )
                    traces.append(
                        (
                            h.tensor_id,
                            checks[i].tensor_id,
                            [(h.tensor_id, 1)],
                            [(checks[i].tensor_id, next_check_legs[i])],
                        )
                    )
                    next_check_legs[i] += 1
                    physical_leg = (z_check.tensor_id, (z_check.tensor_id, 2))

                else:
                    raise ValueError("Y stabilizer is not implemented yet...")

        super().__init__(
            nodes={
                n.tensor_id: n for n in q_tensors + checks + op_tensors + check_stoppers
            }
        )

        for t in traces:
            self.self_trace(*t)
