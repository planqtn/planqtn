from galois import GF2
import numpy as np
from scipy.linalg import block_diag

from linalg import gauss


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


def conjoin(h1: GF2, h2: GF2, leg1: int = 0, leg2: int = 0) -> GF2:
    """Conjoins two parity check matrices via single trace on one leg.

    Key simplifying assumptions compared to the full Cao & Lackey protocol:
        - D=2, i.e. we're working with qubits (elements are 0 and 1)
        - both codes can correct erasures on the two legs
    """

    r1, n1 = h1.shape
    r2, n2 = h2.shape
    n1 //= 2
    n2 //= 2

    assert n1 > 1, "Need at least 2 qubits in h1 for tracing."
    assert n2 > 1, "Need at least 2 qubits in h2 for tracing."

    h1 = gauss(h1, col_subset=[leg1, leg1 + n1])
    h2 = gauss(h2, col_subset=[leg2, leg2 + n2])

    # swap to the first col for easier indexing - they'll be removed anyway

    bring_col_to_front(h1, leg1, 0)
    bring_col_to_front(h1, leg1 + n1, n1)

    bring_col_to_front(h2, leg2, 0)
    bring_col_to_front(h2, leg2 + n2, n2)

    assert np.array_equal(
        h1[[0, 1]][:, [0, n1]], GF2.Identity(2)
    ), f"Error correction property fails on h1 {leg1} leg: {h1[:, [0, n1]]}"
    assert np.array_equal(
        h2[[0, 1]][:, [0, n2]], GF2.Identity(2)
    ), f"Error correction property fails on h2 {leg2} leg: {h2[:, [0, n2]]}"

    print("h1")
    sprint(h1)
    print("h2")
    sprint(h2)

    n3 = n1 + n2 - 2
    r3 = r1 + r2 - 2
    result = GF2.Zeros((r3, 2 * n3))
    # Construct the first row
    result[0] = np.concatenate(
        (h1[0, 1:n1], h2[0, 1:n2], h1[0, n1 + 1 :], h2[0, n2 + 1 :])
    )

    # Construct the second row
    result[1] = np.concatenate(
        (h1[1, 1:n1], h2[1, 1:n2], h1[1, n1 + 1 :], h2[1, n2 + 1 :])
    )

    # A1 and A2
    result[2:, :n3] = block_diag(h1[2:, 1:n1], h2[2:, 1:n2])

    # B1 and B2
    result[2:, n3:] = block_diag(h1[2:, n1 + 1 :], h2[2:, n2 + 1 :])

    return result


def self_trace(h: GF2, leg1: int = 0, leg2: int = 1) -> GF2:
    r, n = h.shape
    n //= 2

    x1, x2, z1, z2 = legs = [leg1, leg2, leg1 + n, leg2 + n]

    mx = gauss(h, col_subset=legs)

    pivot_rows = [np.flatnonzero(mx[:, leg]).tolist()[0] for leg in legs]

    # print(mx)
    # print(pivot_rows)

    # we should have 1 at the top left corner after gauss
    assert (
        mx[0, x1] == 1
    ), "mx has an all zero column, remove before using this function"

    kept_rows = list(range(r))

    # interpret the self trace as measuring ZZ and XX

    # measuring ZZ - if x1 and x2 are the same then we have nothing to do, ZZ commutes with all generators
    # otherwise we have to pick one of them to be the main row, the other will be removed
    if pivot_rows[0] != pivot_rows[1]:
        mx[pivot_rows[0]] += mx[pivot_rows[1]]
        kept_rows.remove(pivot_rows[1])

    # measuring XX - if z1 and z2 are the same then we have nothing to do, XX commutes with all generators
    # otherwise we have to pick one of them to be the main row, the other will be removed
    if pivot_rows[2] != pivot_rows[3]:
        # ensuring that we didn't remove this row in the previous step
        row_to_keep, row_to_remove = (
            (pivot_rows[2], pivot_rows[3])
            if pivot_rows[2] in kept_rows
            else (pivot_rows[3], pivot_rows[2])
        )
        mx[row_to_keep] += mx[row_to_remove]
        kept_rows.remove(row_to_remove)

    kept_cols = np.array([col for col in range(2 * n) if col not in legs])
    kept_rows = np.array(kept_rows)

    mx = mx[kept_rows][:, kept_cols]
    # print("after removals:")
    # print(mx)
    # mx = gauss(mx)
    # kept_rows = list(range(len(mx)))
    # for row in range(len(mx)):
    #     if np.count_nonzero(mx[row]) == 0:
    #         kept_rows.remove(row)
    # mx = mx[kept_rows]
    return mx
