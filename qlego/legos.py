from galois import GF2
import numpy as np


class Legos:

    enconding_tensor_602 = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0],
            [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1],
        ]
    )

    stab_code_parity_422 = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1],
        ]
    )

    def z_rep_code(d=3):
        gens = []
        for i in range(d - 1):
            g = GF2.Zeros(2 * d)
            g[[d + i, d + i + 1]] = 1
            gens.append(g)
        g = GF2.Zeros(2 * d)
        g[np.arange(d)] = 1
        gens.append(g)
        return GF2(gens)

    def x_rep_code(d=3):
        gens = []
        for i in range(d - 1):
            g = GF2.Zeros(2 * d)
            g[[i, i + 1]] = 1
            gens.append(g)
        g = GF2.Zeros(2 * d)
        g[np.arange(d, 2 * d)] = 1
        gens.append(g)
        return GF2(gens)

    enconding_tensor_512 = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]
    )

    enconding_tensor_512_x = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
        ]
    )

    enconding_tensor_512_z = GF2(
        [
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]
    )

    h = GF2(
        [
            [1, 0, 0, 1],
            [0, 1, 1, 0],
        ]
    )
