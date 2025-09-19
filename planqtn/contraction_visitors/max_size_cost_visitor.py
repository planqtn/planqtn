"""Finds the maximum intermediate tensor size during the contraction of
a stabilizer code tensor network."""

from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

if TYPE_CHECKING:
    from planqtn.tensor_network import Contraction

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


def max_tensor_size_cost(
    contraction: "Contraction",
    cotengra: bool = True,
    cotengra_opts: Optional[Dict[Any, Any]] = None,
) -> int:
    """This function uses the MaxTensorSizeCostVisitor to compute the maximum intermediate
    tensor size during a stabilizer code tensor network contraction.

    Args:
        tn (TensorNetwork): The tensor network to analyze.
        open_legs_per_node (dict): A dictionary mapping node indices to lists of open legs.

    Returns:
        int: The largest intermediate tensor size during the contraction.
    """
    visitor = MaxTensorSizeCostVisitor()
    contraction.contract(
        verbose=False,
        visitors=[visitor],
        cotengra=cotengra,
        cotengra_opts=cotengra_opts,
    )
    return visitor.max_size


class MaxTensorSizeCostVisitor(ContractionVisitor):
    """A contraction visitor that finds the largest intermediate tensor size
    during the contraction."""

    def __init__(self) -> None:
        super().__init__()
        self.max_size = 0

    def on_merge(
        self,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        new_pte: StabilizerCodeTensorEnumerator,
        tensor_with: bool = False,
    ) -> None:
        self.max_size = max(self.max_size, 2 ** new_pte.rank())
