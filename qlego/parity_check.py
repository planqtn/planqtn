from galois import GF2
import numpy as np
import scipy
from scipy.linalg import block_diag

from qlego.linalg import gauss


def sprint(h):
    r, n = h.shape
    n //= 2
    for row in h:
        print(
            "".join("_1"[int(b)] for b in row[:n])
            + "|"
            + "".join("_1"[int(b)] for b in row[n:])
        )


def bring_col_to_front(h, col, target_col):
    for c in range(col - 1, target_col - 1, -1):
        h[:, [c, c + 1]] = h[:, [c + 1, c]]


def tensor_product(h1: GF2, h2: GF2) -> GF2:
    """Compute the tensor product of two parity check matrices.

    Args:
        h1: First parity check matrix
        h2: Second parity check matrix

    Returns:
        The tensor product of h1 and h2 as a new parity check matrix
    """
    r1, n1 = h1.shape
    r2, n2 = h2.shape
    n1 //= 2
    n2 //= 2

    h = GF2(
        np.hstack(
            (
                # X
                scipy.linalg.block_diag(h1[:, :n1], h2[:, :n2]),
                # Z
                scipy.linalg.block_diag(h1[:, n1:], h2[:, n2:]),
            )
        )
    )

    assert h.shape == (
        r1 + r2,
        2 * (n1 + n2),
    ), f"{h.shape} != {(r1 + r2, 2 * (n1 + n2))}"

    return h


def conjoin(h1: GF2, h2: GF2, leg1: int = 0, leg2: int = 0) -> GF2:
    """Conjoins two parity check matrices via single trace on one leg."""
    n1 = h1.shape[1] // 2
    h = tensor_product(h1, h2)
    h = self_trace(h, leg1, n1 + leg2)
    return h


def self_trace(h: GF2, leg1: int = 0, leg2: int = 1) -> GF2:
    r, n = h.shape
    n //= 2

    x1, x2, z1, z2 = legs = [leg1, leg2, leg1 + n, leg2 + n]

    mx = gauss(h, col_subset=legs)

    pivot_rows = [np.flatnonzero(mx[:, leg]).tolist() for leg in legs]

    pivot_rows = [-1 if len(pivots) == 0 else pivots[0] for pivots in pivot_rows]

    kept_rows = list(range(r))

    # interpret the self trace as measuring ZZ and XX

    # measuring ZZ - if x1 and x2 are the same then we have nothing to do, ZZ commutes with all generators
    # otherwise we have to pick one of them to be the main row, the other will be removed
    if pivot_rows[0] != pivot_rows[1] and pivot_rows[0] != -1 and pivot_rows[1] != -1:
        mx[pivot_rows[0]] += mx[pivot_rows[1]]
        kept_rows.remove(pivot_rows[1])
    # now, if one of the legs is all zero (pivot row is -1 for those), then we can't make the two legs match with
    # any combination of the generators, thus we'll remove the offending remaining row
    elif pivot_rows[0] == -1 and pivot_rows[1] != -1:
        kept_rows.remove(pivot_rows[1])
    elif pivot_rows[0] != -1 and pivot_rows[1] == -1:
        kept_rows.remove(pivot_rows[0])

    # measuring XX - if z1 and z2 are the same then we have nothing to do, XX commutes with all generators
    # otherwise we have to pick one of them to be the main row, the other will be removed
    if pivot_rows[2] != pivot_rows[3] and pivot_rows[2] != -1 and pivot_rows[3] != -1:
        mx[pivot_rows[2]] += mx[pivot_rows[3]]
        kept_rows.remove(pivot_rows[3])

    # now, if one of the legs is all zero (pivot row is -1 for those), then we can't make the two legs match with
    # any combination of the generators, thus we'll remove the offending remaining row
    elif pivot_rows[2] == -1 and pivot_rows[3] != -1:
        kept_rows.remove(pivot_rows[3])

    elif pivot_rows[2] != -1 and pivot_rows[3] == -1:
        kept_rows.remove(pivot_rows[2])

    kept_cols = np.array([col for col in range(2 * n) if col not in legs])
    kept_rows = np.array(kept_rows)

    mx = mx[kept_rows][:, kept_cols]

    # print("after removals:")
    # print(mx)
    mx = gauss(mx, noswaps=True)
    kept_rows = list(range(len(mx)))
    for row in range(len(mx)):
        if np.count_nonzero(mx[row]) == 0:
            kept_rows.remove(row)
    mx = mx[kept_rows]
    return mx
