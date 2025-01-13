from galois import GF2

from qlego.parity_check import conjoin, self_trace, sprint


if __name__ == "__main__":
    h1 = GF2(
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
    sprint(h1)
    h2 = h1.copy()

    h3 = conjoin(h1, h2, 4, 4)
    sprint(h3)

    h4 = self_trace(h3, 4, 9)
    sprint(h4)
