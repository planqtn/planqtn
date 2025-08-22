"""Finds the sparsity of the tensors throughout the contraction."""

from typing import Dict, Set, List, Tuple

from planqtn.contraction_visitor import ContractionVisitor
from planqtn.linalg import rank
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)


Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


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


class SparsityVisitor(ContractionVisitor):
    """A contraction visitor that calculates the sparsity of the tensors
    throughout the contraction of a stabilizer code tensor network."""

    def __init__(self, open_legs_per_node: Dict[TensorId, List[TensorLeg]]):
        self.traceable_legs = dict(open_legs_per_node)
        self.tensor_sparsity = []

    def on_self_trace(
        self,
        trace: Trace,
        pte: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        nodes_in_pte: Set[TensorId],
    ):
        node_idx1, node_idx2, join_legs1, join_legs2 = trace
        # Removing joined legs from traced pte
        new_traceable_legs = [
            leg
            for leg in self.traceable_legs[node_idx1]
            if leg not in join_legs1 and leg not in join_legs2
        ]

        for node in nodes_in_pte:
            self.traceable_legs[node] = new_traceable_legs

        new_tensor_rank = get_rank_for_matrix_legs(
            new_pte, new_traceable_legs
        )

        dense_size = 4**len(new_traceable_legs)
        self.tensor_sparsity.append(
            (2**new_tensor_rank) / dense_size
        )

    def on_merge(
        self,
        trace: Trace,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        new_pte: StabilizerCodeTensorEnumerator,
        merged_nodes: Set[TensorId],
    ):
        node_idx1, node_idx2, join_legs1, join_legs2 = trace
        
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

        new_tensor_rank = get_rank_for_matrix_legs(
            new_pte, new_traceable_legs
        )

        dense_size = 4**len(new_traceable_legs)
        self.tensor_sparsity.append(
            (2**new_tensor_rank) / dense_size
        )

