from galois import GF2

from legos import Legos
from scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from tensor_stabilizer_enumerator import (
    PAULI_X,
    PAULI_Z,
    TensorNetwork,
    TensorStabilizerCodeEnumerator,
)

from sympy.abc import w, z

if __name__ == "__main__":

    z_rep_code = GF2(
        [
            [0, 0, 0, 1, 1, 0],
            [1, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 0, 1],
        ]
    )

    tn = TensorNetwork.make_rsc(
        3,
        lambda i: (
            Legos.econding_tensor_512 if i % 2 == 0 else Legos.econding_tensor_602
        ),
    )

    print(tn.stabilizer_enumerator_polynomial())

    conjoined = tn.conjoin_nodes()
    print(conjoined.h)

    print(conjoined.stabilizer_enumerator())
