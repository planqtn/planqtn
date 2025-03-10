from galois import GF2
import numpy as np

from qlego.linalg import gauss
from qlego.parity_check import conjoin, self_trace, sprint
from qlego.symplectic import omega


if __name__ == "__main__":
    h1 = GF2(
        [
            # fmt: off
        #        l1,2            l1,2 
        [1,1,1,1, 0,0,  0,0,0,0,  0,0],
        [0,0,0,0, 0,0,  1,1,1,1,  0,0], 
        # X1
        [1,1,0,0, 0,1,  0,0,0,0,  0,0],
        # X0
        [1,0,0,1, 1,0,  0,0,0,0,  0,0],       
        # Z0
        [0,0,0,0, 0,0,  1,1,0,0,  1,0],
        # Z1
        [0,0,0,0, 0,0,  1,0,0,1,  0,1],
            # fmt: on
        ]
    )
    sprint(h1)
    h2 = h1.copy()

    h3 = conjoin(h1, h2, 0, 3)
    sprint(h3)

    h4 = self_trace(h3, 0, 7)
    sprint(h4)
    print("---")
    h5 = gauss(h4, col_subset=[2, 3, 6, 7, 10, 11, 14, 15])
    r, n = h5.shape
    n //= 2
    for i, row in enumerate(h5):
        print(
            f"g{i}:"
            + "".join("_1"[int(b)] for b in row[:n])
            + "|"
            + "".join("_1"[int(b)] for b in row[n:])
        )

    print(f"Things still commute: {np.count_nonzero(h5 @ omega(8) @ h5.T)==0}")

    print("---")

    h6 = self_trace(h5, 2, 3)

    sprint(h6)

    print(h6 @ omega(6) @ h6.T)
    print(f"Things still commute: {np.count_nonzero(h6 @ omega(6) @ h6.T)==0}")
