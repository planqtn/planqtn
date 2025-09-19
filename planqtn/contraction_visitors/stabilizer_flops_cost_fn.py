"""Calculates the cost of contracting a stabilizer code tensor network
based only on the parity check matrix."""

from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.symplectic import count_matching_stabilizers_ratio_all_pairs
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

if TYPE_CHECKING:
    from planqtn.tensor_network import Contraction

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


def custom_flops_cost_stabilizer_codes(
    contraction: "Contraction",
    cotengra=True,
    cotengra_opts: Optional[Dict[Any, Any]] = None,
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
    visitor = StabilizerCodeFlopsCostVisitor()
    contraction.contract(
        verbose=False,
        visitors=[visitor],
        cotengra=cotengra,
        cotengra_opts=cotengra_opts,
    )
    return visitor.total_cost


class StabilizerCodeFlopsCostVisitor(ContractionVisitor):
    """A contraction visitor that calculates the cost of contracting a stabilizer code
    tensor network from the parity check matrices of the nodes."""

    def __init__(self) -> None:
        super().__init__()
        self.total_cost = 0

    def on_merge(
        self,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        new_pte: StabilizerCodeTensorEnumerator,
        tensor_with: bool = False,
    ) -> None:
        prev_submatrix1 = pte1.rank()
        prev_submatrix2 = pte2.rank()

        if (
            not join_legs1 and not join_legs2
        ) or tensor_with:  # If no legs to join, just tensor product so go over all keys
            matches = 1.0
        else:
            matches = count_matching_stabilizers_ratio_all_pairs(
                pte1, pte2, join_legs1, join_legs2
            )

        self.total_cost += (2 ** (prev_submatrix1 + prev_submatrix2)) * matches
