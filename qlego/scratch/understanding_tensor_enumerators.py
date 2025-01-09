from typing import List, Dict
from galois import GF2
import numpy as np
import sympy

from parity_check import sprint
from scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from symplectic import omega, weight

from sympy.abc import w, z

from tensor_stabilizer_enumerator import TensorStabilizerCodeEnumerator


if __name__ == "__main__":

    enc_tens_422 = GF2(
        [
            # fmt: off
        #        l1,2            l1,2 
        [1,1,1,1, 0,0,  0,0,0,0,  0,0],
        [0,0,0,0, 0,0,  1,1,1,1,  0,0], 
        # X1
        [1,1,0,0, 1,0,  0,0,0,0,  0,0],
        # X2
        [1,0,0,1, 0,1,  0,0,0,0,  0,0],       
        # Z2
        [0,0,0,0, 0,0,  1,1,0,0,  0,1],
        # Z1
        [0,0,0,0, 0,0,  1,0,0,1,  1,0],
            # fmt: on
        ]
    )

    scalar_enum = ScalarStabilizerCodeEnumerator(enc_tens_422)
    print(scalar_enum.stabilizer_enumerator)

    vec_enum_on_logical_legs = TensorStabilizerCodeEnumerator(enc_tens_422, [4, 5])

    print(
        vec_enum_on_logical_legs.stabilizer_enumerator(
            e=GF2.Zeros(4), eprime=GF2.Zeros(4)
        )
    )

    vec_enum_phys_legs = TensorStabilizerCodeEnumerator(enc_tens_422, [0, 1, 2, 3])
    print(
        vec_enum_phys_legs.stabilizer_enumerator(
            e=GF2([1, 1, 1, 1, 0, 0, 0, 0]), eprime=GF2.Zeros(8)
        )
    )
