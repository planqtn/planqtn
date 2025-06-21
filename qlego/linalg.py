from copy import deepcopy
from galois import GF2
import numpy as np
from typing import Iterable, Optional, List


def gauss(
    mx: GF2, noswaps: bool = False, col_subset: Optional[Iterable[int]] = None
) -> GF2:
    """GF2 matrix Gauss elimination."""
    res: GF2 = deepcopy(mx)
    if not isinstance(mx, GF2):
        raise ValueError(f"Matrix is not of GF2 type, but instead {type(mx)}")
    if len(mx.shape) == 1:
        return res

    (rows, cols) = mx.shape

    idx = 0
    swaps = []

    if col_subset is None:
        col_subset = range(cols)

    for c in col_subset:
        assert c < cols, f"Column {c} does not exist in mx: \n{mx}"
        # if a col is all zero below, we leave it without increasing idx
        nzs = (np.flatnonzero(res[idx:, c]) + idx).tolist()
        if len(nzs) == 0:
            continue
        # find the first non-zero element in each column starting from idx
        pivot = nzs[0]

        # print(res)
        # print(f"col {c} idx {idx} pivot {pivot}")
        # print(res)

        if pivot != idx:
            # print("swapping")
            res[[pivot, idx]] = res[[idx, pivot]]
            swaps.append((pivot, idx))
            pivot = idx
        # ensure all other rows are zero in the pivot column
        # print(res)
        idxs = np.flatnonzero(res[:, c]).tolist()
        # print(idxs)
        idxs.remove(pivot)
        res[idxs] += res[pivot]

        idx += 1
        if idx == rows:
            break

    if noswaps:
        for pivot, idx in reversed(swaps):
            res[[pivot, idx]] = res[[idx, pivot]]

    return res


def gauss_row_augmented(mx: GF2) -> GF2:
    (rows, cols) = mx.shape
    res: GF2 = deepcopy(mx)
    n = rows
    aug = GF2(np.hstack([res, GF2.Identity(n)]))
    a = gauss(aug)
    return a


def right_kernel(mx: GF2) -> GF2:
    (rows, cols) = mx.shape
    a = gauss_row_augmented(mx.T)

    zero_rows = np.argwhere(np.all(a[..., :rows] == 0, axis=1)).flatten()
    if len(zero_rows) == 0:
        # an invertible matrix will have the trivial nullspace
        return GF2([GF2.Zeros(cols)])
    else:
        return GF2(a[zero_rows, rows:])


def invert(mx: GF2) -> GF2:
    if not isinstance(mx, GF2):
        raise ValueError(f"Matrix is not of GF2 type, but instead {type(mx)}")

    if len(mx.shape) == 1:
        raise ValueError("Only square matrices are allowed")
    (rows, cols) = mx.shape
    if rows != cols:
        raise ValueError(f"Can't invert a {rows} x {cols} non-square matrix.")
    n = rows
    a = gauss_row_augmented(mx)
    if not np.array_equal(a[:, :n], GF2.Identity(n)):
        raise ValueError(
            f"Matrix is singular, has rank: {np.linalg.matrix_rank(a[:,:n])}"
        )

    return GF2(a[:, n:])
