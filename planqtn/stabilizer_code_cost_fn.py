"""Calculates the cost of contracting a stabilizer code tensor network 
based only on the parity check matrix."""

from typing import TYPE_CHECKING, Dict, Set, List, Tuple
from itertools import product
from galois import GF2
import numpy as np

from planqtn.contraction_visitor import ContractionVisitor
from planqtn.linalg import rank
from planqtn.parity_check import tensor_product
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

if TYPE_CHECKING:
    from .tensor_network import TensorNetwork

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


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


def custom_cost_stabilizer_codes(
    tn: "TensorNetwork", open_legs_per_node: Dict[TensorId, List[TensorLeg]]
) -> int:
    """This function uses the StabilizerCodeCostVisitor to compute the total cost of a stabilizer
    code tensor network contraction. The visitor calculates the cost of a contraction step during
    the conjoining of nodes in the tensor network.

    Args:
        tn (TensorNetwork): The tensor network to analyze.
        open_legs_per_node (dict): A dictionary mapping node indices to lists of open legs.

    Returns:
        int: The total number of operations of the tensor network contraction.
    """
    visitor = StabilizerCodeCostVisitor(open_legs_per_node)
    tn.conjoin_nodes(verbose=False, visitor=visitor)
    return visitor.total_cost


class StabilizerCodeCostVisitor(ContractionVisitor):
    """A contraction visitor that calculates the cost of contracting a stabilizer code
    tensor network from the parity check matrices of the nodes."""

    def __init__(self, open_legs_per_node: Dict[TensorId, List[TensorLeg]]):
        self.traceable_legs = dict(open_legs_per_node)
        self.total_cost = 0

    def on_self_trace(
        self,
        node_idx1: TensorId,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        pte: StabilizerCodeTensorEnumerator,
        nodes_in_pte: Set[TensorId],
    ):
        # Removing joined legs from traced pte
        new_traceable_legs = [
            leg
            for leg in self.traceable_legs[node_idx1]
            if leg not in join_legs1 and leg not in join_legs2
        ]

        for node in nodes_in_pte:
            self.traceable_legs[node] = new_traceable_legs

        prev_rank_submatrix = get_rank_for_matrix_legs(
            pte, new_traceable_legs + join_legs1 + join_legs2
        )

        # Get the columns of the parity check matrix corresponding to the join legs
        join_idxs = get_col_indices(pte, join_legs1)
        join_idxs2 = get_col_indices(pte, join_legs2)
        open_cols_matrix = pte.h[
            :, [join_idxs[0], join_idxs2[0], join_idxs[1], join_idxs2[1]]
        ]

        matches = count_matching_stabilizers_ratio(open_cols_matrix)
        self.total_cost += (2 ** (prev_rank_submatrix)) * matches

    def on_merge(
        self,
        node_idx1: TensorId,
        node_idx2: TensorId,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        merged_nodes: Set[TensorId],
    ):
        prev_submatrix1 = get_rank_for_matrix_legs(pte1, self.traceable_legs[node_idx1])
        prev_submatrix2 = get_rank_for_matrix_legs(pte2, self.traceable_legs[node_idx2])

        # Get the columns of the parity check matrix corresponding to the join legs
        join_idxs = get_col_indices(pte1, join_legs1)
        join_idxs2 = get_col_indices(pte2, join_legs2)
        open_cols_matrix1 = pte1.h[:, join_idxs]
        open_cols_matrix2 = pte2.h[:, join_idxs2]

        tensor_prod = tensor_product(open_cols_matrix1, open_cols_matrix2)
        matches = count_matching_stabilizers_ratio(tensor_prod)
        self.total_cost += (2 ** (prev_submatrix1 + prev_submatrix2)) * matches

        # Merge open legs and remove the join legs for merged pte
        new_traceable_legs = [
            leg
            for node_legs in (
                self.traceable_legs[node_idx1],
                self.traceable_legs[node_idx2],
            )
            for leg in node_legs
            if leg not in join_legs1 and leg not in join_legs2
        ]

        for node in merged_nodes:
            self.traceable_legs[node] = new_traceable_legs
