"""The `HaPPY Code` module.

It contains the `HolographicHappyTN` class, which implements a tensor network
representation of the HaPPY code using the perfect [[5,1,3]] code tensors.

The idea was first published in:

Pastawski, Fernando, Beni Yoshida, Daniel Harlow, and John Preskill. 2015.
“Holographic Quantum Error-Correcting Codes: Toy Models for the Bulk/Boundary Correspondence.”
Journal of High Energy Physics 2015 (6): 149. https://doi.org/10.1007/JHEP06(2015)149

This implementation is based on the following work:

Gesteau, Elliott, and Monica Jinwoo Kang. 2020.
“The Infinite-Dimensional HaPPY Code: Entanglement Wedge Reconstruction and Dynamics.”
arXiv preprint arXiv:2005.05971. https://arxiv.org/abs/2005.05971
"""

from galois import GF2
import numpy as np

from planqtn.legos import Legos
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.tensor_network import TensorNetwork


class HolographicHappyTN(TensorNetwork):
    """A tensor network representation of the holographic HaPPY code.

    This class constructs a tensor network for a HaPPY code given a number of layers.
    The HaPPY code uses the perfect [[5,1,3]] code tensors as building blocks,
    arranged in a hyperbolic tiling pattern.
    """

    def __init__(
        self,
        num_layers,
        *,
        lego=Legos.perf513,
        coset_error: GF2 = None,
        truncate_length: int = None,
    ):
        """Construct a HaPPY code tensor network.

        Args:
            num_layers: Number of layers in the HaPPY code.
            lego: Function that returns the lego tensor for each node.
            coset_error: Optional coset error for weight enumerator calculations.
            truncate_length: Optional maximum weight for truncating enumerators.
        """
        self.n = self._num_physical_qubits(num_layers)
        nodes = {}
        connections = []

        # Central lego
        nodes[(0, 0)] = StabilizerCodeTensorEnumerator(lego, tensor_id=(0, 0))

        # Add legos for the number of layers given
        for i in range(num_layers - 1):
            open_legs_per_node = self._find_open_legs(connections, nodes)
            prev_layer_nodes = {k: v for k, v in nodes.items() if k[0] == i}
            count = 0

            # Add a lego for each open leg on each node in the previous layer
            for prev_node in prev_layer_nodes.keys():
                open_legs = open_legs_per_node[prev_node]
                for leg in open_legs:
                    nodes[(i + 1, count)] = StabilizerCodeTensorEnumerator(
                        lego, tensor_id=(i + 1, count)
                    )
                    connections.append([prev_node, (i + 1, count), leg, 0])
                    count += 1

            # Add legos between the newly added legos to form a ring
            curr_layer_nodes = {k: v for k, v in nodes.items() if k[0] == i + 1}
            for j, node in enumerate(curr_layer_nodes.keys()):
                new_idx = len(curr_layer_nodes) + j
                nodes[(i + 1, new_idx)] = StabilizerCodeTensorEnumerator(
                    lego, tensor_id=(i + 1, new_idx)
                )
                connections.append([(i + 1, new_idx), node, 0, 1 if j == 0 else 2])

                # if on last node, wrap around back to first
                if j == len(curr_layer_nodes.keys()) - 1:
                    connections.append([(i + 1, new_idx), (i + 1, 0), 1, 2])
                else:
                    connections.append([(i + 1, new_idx), (i + 1, j + 1), 1, 1])

        super().__init__(nodes, truncate_length=truncate_length)

        self.connections = connections

        for node_a, node_b, leg_a, leg_b in connections:
            self.self_trace(node_a, node_b, [leg_a], [leg_b])

        self.set_coset(
            coset_error if coset_error is not None else GF2.Zeros(2 * self.n)
        )

    def _find_edges_vertices_at_layer(self, n):
        """Finds the number of edges and vertices at a given layer n."""
        e = round(
            (-5 / 2)
            * (
                (1 + np.sqrt(3)) * (2 - np.sqrt(3)) ** n
                + (1 - np.sqrt(3)) * (2 + np.sqrt(3)) ** n
            )
        )
        v = round(
            (5 / (2 * np.sqrt(3)))
            * (
                (1 + np.sqrt(3)) * (2 - np.sqrt(3)) ** n
                - (1 - np.sqrt(3)) * (2 + np.sqrt(3)) ** n
            )
        )
        return e, v

    def _num_bulk(self, n):
        """Finds the number of bulk qubits (vertices) at layer n."""
        e, v = self._find_edges_vertices_at_layer(n - 1)
        return e + v

    def _num_physical_qubits(self, n):
        """Finds the number of boundary qubits (physical qubits) at layer n."""
        e, _ = self._find_edges_vertices_at_layer(n)
        return e

    def qubit_to_node_and_leg(self, q):
        # Physical qubits are all open legs left on last layer
        open_legs_per_node = self._find_open_legs(self.connections, self.nodes)
        qubit_count = 0
        for key, _ in sorted(self.nodes.items(), key=lambda item: item[0][1]):
            open_legs = list(open_legs_per_node[key])
            if qubit_count + len(open_legs) >= q + 1:
                # qubit is in current node!
                leg_idx = q - qubit_count
                return key, (key, open_legs[leg_idx])
            qubit_count += len(open_legs)
        return None

    def n_qubits(self):
        return self.n

    def _find_open_legs(self, connections, nodes):
        used_legs = {}

        for coord1, coord2, leg1, leg2 in connections:
            if coord1 not in used_legs:
                used_legs[coord1] = set()
            if coord2 not in used_legs:
                used_legs[coord2] = set()

            used_legs[coord1].add(leg1)
            used_legs[coord2].add(leg2)

        all_legs = set(range(5))
        # open_legs = {coord: all_legs - legs for coord, legs in used_legs.items()}
        open_legs = {}
        for coord in nodes:
            used = used_legs.get(coord, set())
            open_legs[coord] = all_legs - used
        return open_legs
