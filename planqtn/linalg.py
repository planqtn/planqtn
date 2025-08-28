"""Linear algebra utilities."""

from copy import deepcopy
from typing import Iterable

import numpy as np
from galois import GF2


def gauss(
    mx: GF2, noswaps: bool = False, col_subset: Iterable[int] | None = None
) -> GF2:
    """Perform Gauss elimination on a GF2 matrix.

    Performs row reduction on a GF2 matrix to bring it to row echelon form.
    Optionally can restrict elimination to a subset of columns and control
    whether row swaps are preserved.

    Args:
        mx: Input GF2 matrix to eliminate.
        noswaps: If True, undo row swaps at the end.
        col_subset: Subset of columns to perform elimination on.

    Returns:
        GF2: Matrix in row echelon form.

    Raises:
        ValueError: If the matrix is not of GF2 type.
    """
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
    """Perform Gauss elimination on a row-augmented matrix.

    Creates a row-augmented matrix by appending the identity matrix to the right
    of the input matrix, then performs Gauss elimination. This is useful for
    computing matrix inverses and kernels.

    Args:
        mx: Input GF2 matrix.

    Returns:
        GF2: Row-augmented matrix after Gauss elimination.
    """
    res: GF2 = deepcopy(mx)
    return gauss(GF2(np.hstack([res, GF2.Identity(mx.shape[0])])))


def right_kernel(mx: GF2) -> GF2:
    """Compute the right kernel (nullspace) of a GF2 matrix.

    Computes a basis for the right kernel of the matrix, which consists of
    all vectors v such that mx * v = 0. Uses row-augmented Gauss elimination
    on the transpose of the matrix.

    Args:
        mx: Input GF2 matrix.

    Returns:
        GF2: Matrix whose rows form a basis for the right kernel.
    """
    (rows, cols) = mx.shape
    a = gauss_row_augmented(mx.T)

    zero_rows = np.argwhere(np.all(a[..., :rows] == 0, axis=1)).flatten()
    if len(zero_rows) == 0:
        # an invertible matrix will have the trivial nullspace
        return GF2([GF2.Zeros(cols)])
    return GF2(a[zero_rows, rows:])


def invert(mx: GF2) -> GF2:
    """Invert a square GF2 matrix.

    Computes the inverse of a square GF2 matrix using row-augmented Gauss elimination.
    The matrix must be non-singular (full rank) for the inverse to exist.

    Args:
        mx: Square GF2 matrix to invert.

    Returns:
        GF2: The inverse of the input matrix.

    Raises:
        ValueError: If the matrix is not GF2 type, not square, or singular.
    """
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


def rank(mx: GF2) -> int:
    """Compute the rank of a GF2 matrix."""
    return int(mx.row_space().shape[0])
