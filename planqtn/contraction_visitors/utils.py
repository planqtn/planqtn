from itertools import product
from typing import List
from galois import GF2
import numpy as np

from planqtn.linalg import rank
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator


def count_matching_stabilizers_ratio(generators: GF2) -> float:
    """
    Given k x 2n binary matrix of generators (symplectic form),
    find all stabilizers that they generate. Returns the ratio
    of stabilizers that match on all qubits.
    """
    basis = np.array(generators.row_space())
    r, n2 = basis.shape
    n = n2 // 2
    count = 0

    stabilizers = np.zeros((2**r, n2), dtype=int)
    # Loop through all possible combinations of generators
    for i, bits in enumerate(product([0, 1], repeat=r)):
        combo = np.zeros(n2, dtype=int)
        for j, b in enumerate(bits):
            if b:
                combo ^= basis[j]

        stabilizers[i] = combo
        x = combo[:n]
        z = combo[n:]
        # If all pauli operators are the same, we have a match
        if np.all(x == x[0]) and np.all(z == z[0]):
            count += 1
    return count / 2**r


def get_rank_for_matrix_legs(
    pte: StabilizerCodeTensorEnumerator, open_legs: List[str]
) -> int:
    """Finds the columns of the parity check matrix corresponding to the given open legs.
    Returns the rank of the submatrix formed by those columns.

    Args:
        pte (StabilizerCodeTensorEnumerator): Contains the parity check matrix information.
        open_legs (List[str]): List of legs to match to pte and consider in calculation.

    Returns:
        int: Rank of the submatrix formed by the columns corresponding to the open legs.
    """
    open_legs_set = set(open_legs)
    open_leg_indices = get_col_indices(pte, open_legs_set)
    open_leg_submatrix = pte.h[:, open_leg_indices]
    return rank(open_leg_submatrix)


def get_col_indices(pte: StabilizerCodeTensorEnumerator, legs: List[str]) -> List[int]:
    """Helper method to find the column indices in the parity check matrix
    corresponding to the given legs.

    Args:
        pte (StabilizerCodeTensorEnumerator): Contains the parity check matrix information.
        legs (List[str]): List of legs to find indices for.

    Returns:
        List[int]: List of column indices that correspond to the given legs.
    """
    idxs = [i for i, leg in enumerate(pte.legs) if leg in legs]
    idxs += [i + (pte.h.shape[1] // 2) for i, leg in enumerate(pte.legs) if leg in legs]
    return idxs
