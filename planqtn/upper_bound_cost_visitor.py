
from typing import TYPE_CHECKING, Dict, Set, List, Tuple

from planqtn.contraction_visitor import ContractionVisitor
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
)

if TYPE_CHECKING:   
    from planqtn.tensor_network import TensorNetwork
    
Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


def upper_bound_cost_stabilizer_codes(
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
    visitor = UpperBoundCostVisitor(open_legs_per_node)
    tn.conjoin_nodes(verbose=False, visitor=visitor)
    return visitor.total_cost


class UpperBoundCostVisitor(ContractionVisitor):
    """A contraction visitor that calculates the cost of contracting a stabilizer code
    tensor network from the parity check matrices of the nodes."""

    def __init__(self, open_legs_per_node: Dict[TensorId, List[TensorLeg]]):
        self.open_legs_count = {node_idx: len(legs) for node_idx, legs in open_legs_per_node.items()}
        self.total_cost = 0

    def on_self_trace(
        self,
        trace: Trace,
        pte: StabilizerCodeTensorEnumerator,
        nodes_in_pte: Set[TensorId],
    ):
        node_idx1, _, _, _ = trace
        open_legs1 = self.open_legs_count.get(node_idx1, 0)

        for node in nodes_in_pte:
            self.open_legs_count[node] = open_legs1 - 2

        open_legs1 -= 1
        
        exp = int(open_legs1) + int(open_legs1) + min(int(open_legs1), int(open_legs1))
        self.total_cost += 2 ** exp

    def on_merge(
        self,
        trace: Trace,
        pte1: StabilizerCodeTensorEnumerator,
        pte2: StabilizerCodeTensorEnumerator,
        merged_nodes: Set[TensorId],
    ):
        node_idx1, node_idx2, _, _ = trace
        open_legs1 = self.open_legs_count.get(node_idx1, 0)
        open_legs2 = self.open_legs_count.get(node_idx2, 0)

        for node in merged_nodes:
            self.open_legs_count[node] = open_legs1 + open_legs2 - 1
            
        exp = int(open_legs1) + int(open_legs2) + min(int(open_legs1), int(open_legs2))
        self.total_cost += 2 ** exp