from galois import GF2
import numpy as np

from linalg import gauss
from parity_check import conjoin, self_trace, sprint
from symplectic import omega


if __name__ == "__main__":
    h1 = GF2(
        [
            # fmt: off
        #        l1,2            l1,2 
        [1,1,1,1, 0,0,0,0,],
        [0,0,0,0, 1,0,1,0,],
        [0,0,0,0, 0,1,0,1,],
            # fmt: on
        ]
    )
    sprint(h1)
    h2 = h1.copy()

    h3 = conjoin(h1, h2, 0, 2)
    sprint(h3)

    h4 = self_trace(h3, 0, 1)
    sprint(h4)
    print("---")
    h5 = gauss(h4, col_subset=[2, 3, 6, 7, 10, 11, 14, 15])
    sprint(h5)
