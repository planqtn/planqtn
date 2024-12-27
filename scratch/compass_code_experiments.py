import sys
from galois import GF2
import numpy as np

from legos import Legos
from linalg import gauss
from parity_check import sprint
from scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from tensor_stabilizer_enumerator import (
    PAULI_X,
    PAULI_Z,
    TensorNetwork,
    TensorStabilizerCodeEnumerator,
    sconcat,
)

from sympy.abc import w, z

if __name__ == "__main__":

    # tn = TensorNetwork.make_surface_code(
    #     3,
    #     lambda idx: (
    #         Legos.econding_tensor_512 if idx[0] % 2 == 0 else Legos.stab_code_parity_422
    #     ),
    # )

    d = 3

    tn = TensorNetwork.make_surface_code(
        d,
        lambda idx: (Legos.econding_tensor_512),
    )

    coloring = np.array(
        [
            [1, 1],
            [2, 1],
        ]
    )

    gauge_idxs = [
        (r, c) for r in range(1, 2 * d - 1, 2) for c in range(1, 2 * d - 1, 2)
    ]
    print(gauge_idxs)
    for n, color in zip(gauge_idxs, coloring.reshape(coloring.size)):
        tn.nodes[n] = tn.nodes[n].trace_with_stopper(
            PAULI_Z if color == 2 else PAULI_X, 4
        )

    print("WEP from TN:", tn.stabilizer_enumerator_polynomial())

    conjoined = tn.conjoin_nodes()
    # for leg in [(idx, 4) for idx in tn.nodes.keys() if idx[0] % 2 == 1]:
    #     conjoined = conjoined.trace_with_stopper(PAULI_Z, leg)

    np.set_printoptions(threshold=sys.maxsize, linewidth=800)

    s = gauss(conjoined.h)
    sprint(s)
    print(conjoined.legs)
    print(ScalarStabilizerCodeEnumerator(conjoined.h).stabilizer_enumerator(10))

    print(
        ScalarStabilizerCodeEnumerator(
            GF2(
                [
                    [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
                ]
            )
        ).stabilizer_enumerator(10)
    )

    # for gi, g in enumerate(s):
    #     for v in [
    #         (
    #             conjoined.legs[idx][0]
    #             if idx < conjoined.n
    #             else conjoined.legs[idx - conjoined.n][0]
    #         )
    #         for idx in np.nonzero(g)[0]
    #     ]:

    #         print(f"{gi} -- n{v[0]}_{v[1]}")
