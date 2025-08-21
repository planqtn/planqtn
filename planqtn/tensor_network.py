"""The `tensor_network` module.

It contains the [`TensorNetwork`][planqtn.TensorNetwork] class which contains all the
logic for contracting a tensor network to calculate weight enumerator polynomials.

The main methods are:

- [`self_trace`][planqtn.TensorNetwork.self_trace]: Sets up a contraction between
    two nodes in the tensornetwork and corresponding legs.
- [`stabilizer_enumerator_polynomial`][planqtn.TensorNetwork.stabilizer_enumerator_polynomial]:
   Returns the reduced stabilizer enumerator polynomial for the tensor network.
- [`conjoin_nodes`][planqtn.TensorNetwork.conjoin_nodes]: Conjoins two nodes in the
    tensor network into a single stabilizer code tensor.
"""

import importlib.util
from collections import defaultdict
from copy import deepcopy
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Set, Tuple, Union

import cotengra as ctg
from cotengra.scoring import ensure_basic_quantities_are_computed
import numpy as np
from galois import GF2

from planqtn.contraction_visitor import ContractionVisitor
from planqtn.stabilizer_code_cost_fn import custom_cost_stabilizer_codes
from planqtn.symplectic import sprint
from planqtn.pauli import Pauli
from planqtn.progress_reporter import (
    DummyProgressReporter,
    ProgressReporter,
    TqdmProgressReporter,
)
from planqtn.poly import UnivariatePoly
from planqtn.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    TensorId,
    TensorLeg,
    TensorEnumerator,
    TensorEnumeratorKey,
    _index_leg,
    _index_legs,
)


Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


class TensorNetwork:
    """A tensor network for contracting stabilizer code tensor enumerators."""

    def __init__(
        self,
        nodes: Union[
            Iterable[StabilizerCodeTensorEnumerator],
            Dict[TensorId, StabilizerCodeTensorEnumerator],
        ],
        truncate_length: Optional[int] = None,
    ):
        """Construct a tensor network.

        This class represents a tensor network composed of
        [`StabilizerCodeTensorEnumerator`][planqtn.StabilizerCodeTensorEnumerator]
        nodes that can be contracted together to compute stabilizer enumerator polynomials.
        The trace ordering can be left to use the original manual ordering or use automated,
        hyperoptimized contraction ordering using the `cotengra` library.

        The tensor network maintains a collection of nodes (tensors) and traces (contraction
        operations between nodes). It can compute weight enumerator polynomials for
        stabilizer codes by contracting the network according to the specified traces.

        Args:
            nodes: Dictionary mapping tensor IDs to
                [`StabilizerCodeTensorEnumerator`][planqtn.StabilizerCodeTensorEnumerator] objects.
            truncate_length: Optional maximum length for truncating enumerator polynomials.

        Raises:
            ValueError: If the nodes have inconsistent indexing.
            ValueError: If there are colliding index values in the nodes.
        """
        if isinstance(nodes, dict):
            for k, v in nodes.items():
                if k != v.tensor_id:
                    raise ValueError(
                        f"Nodes dict passed in with inconsitent indexing, "
                        f"{k} != {v.tensor_id} for {v}."
                    )
            self.nodes: Dict[TensorId, StabilizerCodeTensorEnumerator] = nodes
        else:
            nodes_dict = {node.tensor_id: node for node in nodes}
            if len(nodes_dict) < len(list(nodes)):
                raise ValueError(f"There are colliding index values of nodes: {nodes}")
            self.nodes = nodes_dict

        self._traces: List[Trace] = []
        self._cot_tree = None
        self._cot_traces: Optional[List[Trace]] = None

        self._legs_left_to_join: Dict[TensorId, List[TensorLeg]] = {
            idx: [] for idx in self.nodes.keys()
        }
        # self.open_legs = [n.legs for n in self.nodes]

        self._wep: Optional[TensorEnumerator | UnivariatePoly] = None
        self._ptes: Dict[TensorId, _PartiallyTracedEnumerator] = {}
        self._coset: Optional[GF2] = None
        self.truncate_length: Optional[int] = truncate_length

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, TensorNetwork):
            return False

        # Compare nodes
        if set(self.nodes.keys()) != set(other.nodes.keys()):
            return False

        for idx in self.nodes:
            if (self.nodes[idx].h != other.nodes[idx].h).any():
                return False
            if self.nodes[idx].legs != other.nodes[idx].legs:
                return False
            if (
                self.nodes[idx].coset_flipped_legs
                != other.nodes[idx].coset_flipped_legs
            ):
                return False

        # Compare traces - convert only the hashable parts to tuples
        def trace_to_comparable(
            trace: Trace,
        ) -> Tuple[TensorId, TensorId, Tuple[TensorLeg, ...], Tuple[TensorLeg, ...]]:
            node_idx1, node_idx2, join_legs1, join_legs2 = trace
            return (node_idx1, node_idx2, tuple(join_legs1), tuple(join_legs2))

        self_traces = {trace_to_comparable(t) for t in self._traces}
        other_traces = {trace_to_comparable(t) for t in other._traces}

        if self_traces != other_traces:
            return False

        return True

    def __hash__(self) -> int:
        # Hash the nodes
        nodes_hash = 0
        for idx in sorted(self.nodes.keys()):
            node = self.nodes[idx]
            nodes_hash ^= hash(
                (
                    idx,
                    tuple(map(tuple, node.h)),
                    tuple(node.legs),
                    (
                        tuple(map(tuple, node.coset_flipped_legs))
                        if node.coset_flipped_legs
                        else None
                    ),
                )
            )

        # Hash the traces - convert only the hashable parts to tuples
        def trace_to_hashable(
            trace: Trace,
        ) -> Tuple[TensorId, TensorId, Tuple[TensorLeg, ...], Tuple[TensorLeg, ...]]:
            node_idx1, node_idx2, join_legs1, join_legs2 = trace
            return (node_idx1, node_idx2, tuple(join_legs1), tuple(join_legs2))

        traces_hash = hash(tuple(sorted(trace_to_hashable(t) for t in self._traces)))

        return nodes_hash ^ traces_hash

    def qubit_to_node_and_leg(self, q: int) -> Tuple[TensorId, TensorLeg]:
        """Map a qubit index to its corresponding node and leg.

        This method maps a global qubit index to the specific node and leg
        that represents that qubit in the tensor network. This is an abstract method
        that must be implemented by subclasses that have a representation for qubits.

        Args:
            q: Global qubit index.

        Returns:
            node_id: Node ID and leg that represent the qubit.
            leg: Leg that represent the qubit.


        Raises:
            NotImplementedError: This method must be implemented by subclasses.
        """  # noqa: DAR202
        raise NotImplementedError(
            f"qubit_to_node_and_leg() is not implemented for {type(self)}!"
        )

    def n_qubits(self) -> int:
        """Get the total number of qubits in the tensor network.

        Returns the total number of qubits represented by this tensor network. This is an abstract
        method that must be implemented by subclasses that have a representation for qubits.

        Returns:
            int: Total number of qubits.

        Raises:
            NotImplementedError: This method must be implemented by subclasses.
        """  # noqa: DAR202
        raise NotImplementedError(f"n_qubits() is not implemented for {type(self)}")

    def _reset_wep(self, keep_cot: bool = False) -> None:

        self._wep = None

        prev_traces = deepcopy(self._traces)
        self._traces = []
        self._legs_left_to_join = {idx: [] for idx in self.nodes.keys()}

        for trace in prev_traces:
            self.self_trace(trace[0], trace[1], [trace[2][0]], [trace[3][0]])

        self._ptes = {}
        self._coset = GF2.Zeros(2 * self.n_qubits())

        if keep_cot:
            self._cot_tree = None
            self._cot_traces = None

    def set_coset(self, coset_error: GF2 | Tuple[List[int], List[int]]) -> None:
        """Set the coset error for the tensor network.

        Sets the coset error that will be used for coset weight enumerator calculations.
        The coset error should follow the qubit numbering defined in
         [`qubit_to_node_and_leg`][planqtn.TensorNetwork.qubit_to_node_and_leg] which maps the index
        to a node ID. Both [`qubit_to_node_and_leg`][planqtn.TensorNetwork.qubit_to_node_and_leg]
        and [`n_qubits`][planqtn.TensorNetwork.n_qubits] are abstract classes, and thus this method
        can only be called on a subclass that implements these methods, see the
        [`planqtn.networks`][planqtn.networks] module for examples.

        There are two possible ways to pass the coset_error:

        - a tuple of two lists of qubit indices, one for the `Z` errors and one for the `X` errors
        - a `galois.GF2` array of length `2 * tn.n_qubits()` for the `tn` tensor network. This is a
            symplectic operator representation on the `n` qubits of the tensor network.

        Args:
            coset_error: The coset error specification.

        Raises:
            ValueError: If the coset error has the wrong number of qubits.
        """
        self._reset_wep(keep_cot=True)

        self._coset = GF2.Zeros(2 * self.n_qubits())

        if isinstance(coset_error, tuple):
            for i in coset_error[0]:
                self._coset[i] = 1
            for i in coset_error[1]:
                self._coset[i + self.n_qubits()] = 1
        elif isinstance(coset_error, GF2):
            self._coset = coset_error

        n = len(self._coset) // 2
        if n != self.n_qubits():
            raise ValueError(
                f"Can't set coset with {n} qubits for a {self.n_qubits()} qubit code."
            )

        z_errors = np.argwhere(self._coset[n:] == 1).flatten()
        x_errors = np.argwhere(self._coset[:n] == 1).flatten()

        node_legs_to_flip = defaultdict(list)

        for q in range(n):
            is_z = q in z_errors
            is_x = q in x_errors
            node_idx, leg = self.qubit_to_node_and_leg(q)

            self.nodes[node_idx].coset_flipped_legs = []
            if not is_z and not is_x:
                continue
            # print(f"q{q} -> {node_idx, leg}")
            node_legs_to_flip[node_idx].append((leg, GF2([is_x, is_z])))

        for node_idx, coset_flipped_legs in node_legs_to_flip.items():

            # print(node_idx, f" will have flipped {coset_flipped_legs}")

            self.nodes[node_idx] = self.nodes[node_idx].with_coset_flipped_legs(
                coset_flipped_legs
            )

    def self_trace(
        self,
        node_idx1: TensorId,
        node_idx2: TensorId,
        join_legs1: Sequence[int | TensorLeg],
        join_legs2: Sequence[int | TensorLeg],
    ) -> None:
        """Add a trace operation between two nodes in the tensor network.

        Defines a contraction between two nodes by specifying which legs to join.
        This operation is added to the trace schedule and will be executed when
        the tensor network is contracted.

        Args:
            node_idx1: ID of the first node to trace.
            node_idx2: ID of the second node to trace.
            join_legs1: Legs from the first node to contract.
            join_legs2: Legs from the second node to contract.

        Raises:
            ValueError: If the weight enumerator has already been computed.
        """
        if self._wep is not None:
            raise ValueError(
                "Tensor network weight enumerator is already traced no new tracing schedule is "
                "allowed."
            )
        join_legs1_indexed = _index_legs(node_idx1, join_legs1)
        join_legs2_indexed = _index_legs(node_idx2, join_legs2)

        # print(f"adding trace {node_idx1, node_idx2, join_legs1, join_legs2}")
        self._traces.append(
            (node_idx1, node_idx2, join_legs1_indexed, join_legs2_indexed)
        )

        self._legs_left_to_join[node_idx1] += join_legs1_indexed
        self._legs_left_to_join[node_idx2] += join_legs2_indexed

    def traces_to_dot(self) -> None:
        """Print the tensor network traces in DOT format.

        Prints the traces (contractions) between nodes in a format that can be
        used to visualize the tensor network structure. Each trace is printed
        as a directed edge between nodes.
        """
        print("-----")
        # print(self.open_legs)
        # for n, legs in enumerate(self.open_legs):
        #     for leg in legs:
        #         print(f"n{n} -> n{n}_{leg}")

        for node_idx1, node_idx2, join_legs1, join_legs2 in self._traces:
            for _ in zip(join_legs1, join_legs2):
                print(f"n{node_idx1} -> n{node_idx2} ")

    def _cotengra_tree_from_traces(
        self,
        free_legs: List[TensorLeg],
        leg_indices: Dict[TensorLeg, str],
    ) -> ctg.ContractionTree:
        inputs, output, size_dict, input_names = self._prep_cotengra_inputs(
            leg_indices, free_legs, True
        )

        path = []
        terms = [{node_idx} for node_idx in input_names]

        def idx(node_id: TensorId) -> int:
            for i, term in enumerate(terms):
                if node_id in term:
                    return i
            assert False, (
                "This should not happen, nodes should be always present in at least one of the "
                "terms."
            )

        for node_idx1, node_idx2, _, _ in self._traces:
            i, j = sorted([idx(node_idx1), idx(node_idx2)])
            # print((node_idx1, node_idx2), f"=> {i,j}", terms)
            if i == j:
                continue
            path.append({i, j})
            term2 = terms.pop(j)
            term1 = terms.pop(i)
            terms.append(term1.union(term2))
        return ctg.ContractionTree.from_path(
            inputs, output, size_dict, path=path, check=True
        )

    def analyze_traces(
        self,
        cotengra: bool = False,
        each_step: bool = False,
        details: bool = False,
        **cotengra_opts: Any,
    ) -> Tuple[ctg.ContractionTree, int]:
        """Analyze the trace operations and optionally optimize the contraction path.

        Analyzes the current trace schedule and can optionally use cotengra to
        find an optimal contraction path. This is useful for understanding the
        computational complexity of the tensor network contraction.

        Args:
            cotengra: If True, use cotengra to optimize the contraction path.
            each_step: If True, print details for each contraction step.
            details: If True, print detailed analysis information.
            **cotengra_opts: Additional options to pass to cotengra.

        Returns:
            Tuple[ctg.ContractionTree, int]: The contraction tree and total cost.
        """
        free_legs, leg_indices, index_to_legs = self._collect_legs()
        tree = None

        open_legs_per_node = defaultdict(list)
        for node_idx, node in self.nodes.items():
            for leg in node.legs:
                if leg not in free_legs:
                    open_legs_per_node[node_idx].append(_index_leg(node_idx, leg))


        new_tn = TensorNetwork(deepcopy(self.nodes))

        # pylint: disable=W0212
        new_tn._traces = deepcopy(self._traces)
        if cotengra:

            new_tn._traces, tree = self._cotengra_contraction(
                free_legs,
                leg_indices,
                index_to_legs,
                open_legs_per_node,
                details,
                TqdmProgressReporter() if details else DummyProgressReporter(),
                **cotengra_opts,
            )
        else:
            tree = self._cotengra_tree_from_traces(free_legs, leg_indices)

        # pylint: disable=W0212
        new_tn._legs_left_to_join = deepcopy(self._legs_left_to_join)

        pte_nodes: Dict[TensorId, int] = {}
        max_pte_legs = 0
        if details:
            print(
                "========================== ======= === === === == ==============================="
            )
            print(
                "========================== TRACE SCHEDULE ANALYSIS ============================="
            )
            print(
                "========================== ======= === === === == ==============================="
            )
            print(
                f"    Total legs to trace: "
                f"{sum(len(legs) for legs in new_tn._legs_left_to_join.values())}"
            )
        pte_leg_numbers: Dict[TensorId, int] = defaultdict(int)

        for node_idx1, node_idx2, join_legs1, join_legs2 in new_tn._traces:
            if each_step:
                print(
                    f"==== trace {node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )

            for leg in join_legs1:
                new_tn._legs_left_to_join[node_idx1].remove(leg)
            for leg in join_legs2:
                new_tn._legs_left_to_join[node_idx2].remove(leg)

            if node_idx1 not in pte_nodes and node_idx2 not in pte_nodes:
                next_pte = 0 if len(pte_nodes) == 0 else max(pte_nodes.values()) + 1
                if each_step:
                    print(f"New PTE: {next_pte}")
                pte_nodes[node_idx1] = next_pte
                pte_nodes[node_idx2] = next_pte
            elif node_idx1 in pte_nodes and node_idx2 not in pte_nodes:
                pte_nodes[node_idx2] = pte_nodes[node_idx1]
            elif node_idx2 in pte_nodes and node_idx1 not in pte_nodes:
                pte_nodes[node_idx1] = pte_nodes[node_idx2]
            elif pte_nodes[node_idx1] == pte_nodes[node_idx2]:
                if each_step:
                    print(f"self trace in PTE {pte_nodes[node_idx1]}")
            else:
                if each_step:
                    print(f"MERGE of {pte_nodes[node_idx1]} and {pte_nodes[node_idx2]}")
                removed_pte = pte_nodes[node_idx2]
                merged_pte = pte_nodes[node_idx1]
                for node_idx, pte_node in pte_nodes.items():
                    if pte_node == removed_pte:
                        pte_nodes[node_idx] = merged_pte

            if details:
                print(f"    pte nodes: {pte_nodes}")
            if each_step:
                print(
                    f"    Total legs to trace: "
                    f"{sum(len(legs) for legs in new_tn._legs_left_to_join.values())}"
                )

            pte_leg_numbers = defaultdict(int)

            for node_idx, pte_node in pte_nodes.items():
                pte_leg_numbers[pte_node] += len(new_tn._legs_left_to_join[node_idx])

            if each_step:
                print(f"     PTEs num tracable legs: {dict(pte_leg_numbers)}")

            biggest_legs = max(pte_leg_numbers.values())

            max_pte_legs = max(max_pte_legs, biggest_legs)
            if each_step:
                print(f"    Biggest PTE legs: {biggest_legs} vs MAX: {max_pte_legs}")
        if details:
            print("=== Final state ==== ")
            print(f"pte nodes: {pte_nodes}")

            print(
                f"all nodes {set(pte_nodes.keys()) == set(new_tn.nodes.keys())} "
                f"and all nodes are in a single PTE: {len(set(pte_nodes.values())) == 1}"
            )
            print(
                f"Total legs to trace: "
                f"{sum(len(legs) for legs in new_tn._legs_left_to_join.values())}"
            )
            print(f"PTEs num tracable legs: {dict(pte_leg_numbers)}")
            print(f"Maximum PTE legs: {max_pte_legs}")
        return tree, max_pte_legs

    def conjoin_nodes(
        self,
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        visitors: List[ContractionVisitor] = [],
    ) -> "StabilizerCodeTensorEnumerator":
        """Conjoin all nodes in the tensor network according to the trace schedule.

        Executes all the trace operations defined in the tensor network to produce
        a single tensor enumerator. This tensor enumerator will have the conjoined parity check
        matrix. However, running weight enumerator calculation on this conjoined node would use the
        brute force method, and as such would be typically more expensive than using the
        [`stabilizer_enumerator_polynomial`][planqtn.TensorNetwork.stabilizer_enumerator_polynomial]
        method.

        Args:
            verbose: If True, print verbose output during contraction.
            progress_reporter: Progress reporter for tracking the contraction process.

        Returns:
            StabilizerCodeTensorEnumerator: The contracted tensor enumerator.
        """
        # If there's only one node and no traces, return it directly
        if len(self.nodes) == 1 and len(self._traces) == 0:
            return list(self.nodes.values())[0]

        # Map from node_idx to the index of its PTE in ptes list
        nodes = list(self.nodes.values())
        ptes: List[Tuple[StabilizerCodeTensorEnumerator, Set[TensorId]]] = [
            (node, {node.tensor_id}) for node in nodes
        ]
        node_to_pte = {node.tensor_id: i for i, node in enumerate(nodes)}

        for trace in progress_reporter.iterate(
            self._traces, "Conjoining nodes", len(self._traces)
        ):
            node_idx1, node_idx2, join_legs1, join_legs2 = trace
            if verbose:
                print(
                    f"==== trace {node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )

            join_legs1 = _index_legs(node_idx1, join_legs1)
            join_legs2 = _index_legs(node_idx2, join_legs2)

            pte1_idx = node_to_pte[node_idx1]
            pte2_idx = node_to_pte[node_idx2]

            # Case 1: Both nodes are in the same PTE
            if pte1_idx == pte2_idx:
                if verbose:
                    print(
                        f"Self trace in PTE containing both {node_idx1} and {node_idx2}"
                    )
                pte, nodes_in_pte = ptes[pte1_idx]
                new_pte = pte.self_trace(join_legs1, join_legs2)
                ptes[pte1_idx] = (new_pte, nodes_in_pte)

                for visitor in visitors:
                    visitor.on_self_trace(
                        trace, pte, nodes_in_pte
                    )

            # Case 2: Nodes are in different PTEs - merge them
            else:
                if verbose:
                    print(f"Merging PTEs containing {node_idx1} and {node_idx2}")
                pte1, nodes1 = ptes[pte1_idx]
                pte2, nodes2 = ptes[pte2_idx]
                new_pte = pte1.conjoin(pte2, legs1=join_legs1, legs2=join_legs2)
                merged_nodes = nodes1.union(nodes2)

                # Update the first PTE with merged result
                ptes[pte1_idx] = (new_pte, merged_nodes)
                # Remove the second PTE
                ptes.pop(pte2_idx)

                # Update node_to_pte mappings
                for node_idx in nodes2:
                    node_to_pte[node_idx] = pte1_idx
                # Adjust indices for all nodes in PTEs after the removed one
                for node_idx, pte_idx in node_to_pte.items():
                    if pte_idx > pte2_idx:
                        node_to_pte[node_idx] = pte_idx - 1

                for visitor in visitors:
                    visitor.on_merge(
                        trace,
                        pte1,
                        pte2,
                        merged_nodes,
                    )

            if verbose:
                print("H:")
                sprint(ptes[0][0].h)

        # If we have multiple components at the end, tensor them together
        if len(ptes) > 1:
            for other in ptes[1:]:
                ptes[0] = (ptes[0][0].tensor_with(other[0]), ptes[0][1].union(other[1]))

        return ptes[0][0]

    def _collect_legs(
        self,
    ) -> Tuple[
        List[TensorLeg],
        Dict[TensorLeg, str],
        Dict[str, List[Tuple[TensorId, TensorLeg]]],
    ]:
        leg_indices = {}
        index_to_legs = {}
        current_index = 0
        free_legs = []
        # Iterate over each node in the tensor network
        for node_idx, node in self.nodes.items():
            # Iterate over each leg in the node
            for leg in node.legs:
                current_idx_name = f"{leg}"
                # If the leg is already indexed, skip it
                if leg in leg_indices:
                    continue
                # Assign the current index to the leg
                leg_indices[leg] = current_idx_name
                index_to_legs[current_idx_name] = [(node_idx, leg)]
                open_leg = True
                # Check for traces and assign the same index to traced legs
                for node_idx1, node_idx2, join_legs1, join_legs2 in self._traces:
                    idx = -1
                    if leg in join_legs1:
                        idx = join_legs1.index(leg)
                    elif leg in join_legs2:
                        idx = join_legs2.index(leg)
                    else:
                        continue
                    open_leg = False
                    current_idx_name = f"{join_legs1[idx]}_{join_legs2[idx]}"
                    leg_indices[join_legs1[idx]] = current_idx_name
                    leg_indices[join_legs2[idx]] = current_idx_name
                    index_to_legs[current_idx_name] = [
                        (node_idx1, join_legs1[idx]),
                        (node_idx2, join_legs2[idx]),
                    ]
                # Move to the next index
                if open_leg:
                    free_legs.append(leg)
                current_index += 1
        return free_legs, leg_indices, index_to_legs

    def _prep_cotengra_inputs(
        self,
        leg_indices: Dict[TensorLeg, str],
        free_legs: List[TensorLeg],
        verbose: bool = False,
    ) -> Tuple[List[Tuple[str, ...]], List[str], Dict[str, int], List[str]]:
        inputs = []
        output: List[str] = []
        size_dict = {leg: 2 for leg in leg_indices.values()}

        input_names = []

        for node_idx, node in self.nodes.items():
            inputs.append(tuple(leg_indices[leg] for leg in node.legs))
            input_names.append(str(node_idx))
            if verbose:
                # Print the indices for each node
                for leg in node.legs:
                    print(
                        f"  Leg {leg}: Index {leg_indices[leg]} "
                        f"{'OPEN' if leg in free_legs else 'traced'}"
                    )
        if verbose:
            print(input_names)
            print(inputs)
            print(output)
            print(size_dict)
        return inputs, output, size_dict, input_names

    def _traces_from_cotengra_tree(
        self,
        tree: ctg.ContractionTree,
        index_to_legs: Dict[str, List[Tuple[TensorId, TensorLeg]]],
        inputs: List[Tuple[str, ...]],
    ) -> List[Trace]:
        def legs_to_contract(l: frozenset, r: frozenset) -> List[Trace]:
            res = []
            left_indices = sum((list(inputs[leaf_idx]) for leaf_idx in l), [])
            right_indices = sum((list(inputs[leaf_idx]) for leaf_idx in r), [])
            for idx1 in left_indices:
                if idx1 in right_indices:
                    legs = index_to_legs[idx1]
                    res.append((legs[0][0], legs[1][0], [legs[0][1]], [legs[1][1]]))
            return res

        # We convert the tree back to a list of traces
        traces = []
        for _, l, r in tree.traverse():
            # at each step we have to find the nodes that share indices in the two merged subsets
            new_traces = legs_to_contract(l, r)
            traces += new_traces

        trace_indices = []
        for t in traces:
            assert t in self._traces, f"{t} not in traces. Traces: {self._traces}"
            idx = self._traces.index(t)
            trace_indices.append(idx)

        assert set(trace_indices) == set(
            range(len(self._traces))
        ), "Some traces are missing from cotengra tree\n" + "\n".join(
            [
                str(self._traces[i])
                for i in set(range(len(self._traces))) - set(trace_indices)
            ]
        )
        return traces
    
    def _make_custom_cost_fn(
        self,
        index_to_legs: Dict[str, List[Tuple[TensorId, TensorLeg]]],
        inputs: List[Tuple[str, ...]],
        open_legs_per_node: Dict[TensorId, List[TensorLeg]],
    ) -> Callable[[Dict], float]:
        def stabilizer_cost_fn(trial_dict):
            tree = trial_dict["tree"]
            ensure_basic_quantities_are_computed(trial_dict)

            traces = self._traces_from_cotengra_tree(
                tree, index_to_legs=index_to_legs, inputs=inputs
            )
            self._traces = traces
            return np.log2(custom_cost_stabilizer_codes(self, open_legs_per_node))

        return stabilizer_cost_fn

    def _cotengra_contraction(
        self,
        free_legs: List[TensorLeg],
        leg_indices: Dict[TensorLeg, str],
        index_to_legs: Dict[str, List[Tuple[TensorId, TensorLeg]]],
        open_legs_per_node: Dict[TensorId, List[TensorLeg]],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        **cotengra_opts: Any,
    ) -> Tuple[
        List[Trace],
        ctg.ContractionTree,
    ]:

        if self._cot_traces is not None:
            return self._cot_traces, self._cot_tree

        inputs, output, size_dict, _ = self._prep_cotengra_inputs(
            leg_indices, free_legs, verbose
        )

        custom = self._make_custom_cost_fn(index_to_legs, inputs, open_legs_per_node)
        
        contengra_params = {
            "minimize": custom,
            "parallel": True,
            # kahypar is not installed by default, but if user has it they can use it by default
            # otherwise, our default is greedy right now
            "methods": [
                "kahypar" if importlib.util.find_spec("kahypar") else "greedy",
                "labels",
            ],
            "optlib": "cmaes",
        }
        contengra_params.update(cotengra_opts)
        opt = ctg.HyperOptimizer(
            **contengra_params,
            progbar=not isinstance(progress_reporter, DummyProgressReporter),
        )

        self._cot_tree = opt.search(inputs, output, size_dict)

        self._cot_traces = self._traces_from_cotengra_tree(
            self._cot_tree, index_to_legs=index_to_legs, inputs=inputs
        )

        return self._cot_traces, self._cot_tree

    # weight_enumerator_polynomial
    # - pass in a list of bool for each node True: stabilizer False: normalizer

    def stabilizer_enumerator_polynomial(
        self,
        open_legs: Sequence[TensorLeg] = (),
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        cotengra: bool = True,
    ) -> TensorEnumerator | UnivariatePoly:
        """Returns the reduced stabilizer enumerator polynomial for the tensor network.

        If open_legs is not empty, then the returned tensor enumerator polynomial is a dictionary of
        tensor keys to UnivariatePoly objects.

        Args:
            open_legs: The legs that are open in the tensor network. If empty, the result is a
                       scalar weightenumerator polynomial of type `UnivariatePoly`,otherwise it is a
                       dictionary of `TensorEnumeratorKey` keys to `UnivariatePoly` objects.
            verbose: If True, print verbose output.
            progress_reporter: The progress reporter to use, defaults to no progress reporting
                              (`DummyProgressReporter`), can be set to `TqdmProgressReporter` for
                              progress reporting on the console, or any other custom
                              `ProgressReporter` subclass.
            cotengra: If True, use cotengra to contract the tensor network, otherwise use the order
                      the traces were constructed.

        Returns:
            TensorEnumerator: The reduced stabilizer enumerator polynomial for the tensor network.
        """
        if self._wep is not None:
            return self._wep

        assert (
            progress_reporter is not None
        ), "Progress reporter must be provided, it is None"

        with progress_reporter.enter_phase("collecting legs"):
            free_legs, leg_indices, index_to_legs = self._collect_legs()

        open_legs_per_node = defaultdict(list)
        for node_idx, node in self.nodes.items():
            for leg in node.legs:
                if leg not in free_legs:
                    open_legs_per_node[node_idx].append(_index_leg(node_idx, leg))

        for node_idx, leg_index in open_legs:
            open_legs_per_node[node_idx].append(_index_leg(node_idx, leg_index))

        if verbose:
            print("open_legs_per_node", open_legs_per_node)
        traces = self._traces
        if cotengra and len(self.nodes) > 0 and len(self._traces) > 0:
            with progress_reporter.enter_phase("cotengra contraction"):
                traces, _ = self._cotengra_contraction(
                    free_legs, leg_indices, index_to_legs, verbose, progress_reporter
                )
        summed_legs = [leg for leg in free_legs if leg not in open_legs]

        if len(self._traces) == 0 and len(self.nodes) == 1:
            return list(self.nodes.items())[0][1].stabilizer_enumerator_polynomial(
                verbose=verbose,
                progress_reporter=progress_reporter,
                truncate_length=self.truncate_length,
                open_legs=open_legs,
            )

        # parity_check_enums = {}

        for node_idx, node in self.nodes.items():
            traced_legs = open_legs_per_node[node_idx]
            # TODO: figure out tensor caching
            # traced_leg_indices = "".join(
            #     [str(i) for i in sorted([node.legs.index(leg) for leg in traced_legs])]
            # )
            # hkey = sstr(gauss(node.h)) + ";" + traced_leg_indices
            # if hkey not in parity_check_enums:
            #     parity_check_enums[hkey] = node.stabilizer_enumerator_polynomial(
            #         open_legs=traced_legs
            #     )
            # else:
            #     print("Found one!")
            #     calc = node.stabilizer_enumerator_polynomial(open_legs=traced_legs)
            #     assert (
            #         calc == parity_check_enums[hkey]
            #     ), f"for key {hkey}\n calc\n{calc}\n vs retrieved\n{parity_check_enums[hkey]}"

            # call the right type here...
            tensor = node.stabilizer_enumerator_polynomial(
                open_legs=traced_legs,
                verbose=verbose,
                progress_reporter=progress_reporter,
                truncate_length=self.truncate_length,
            )
            if isinstance(tensor, UnivariatePoly):
                tensor = {(): tensor}
            self._ptes[node_idx] = _PartiallyTracedEnumerator(
                nodes={node_idx},
                tracable_legs=open_legs_per_node[node_idx],
                tensor=tensor,  # deepcopy(parity_check_enums[hkey]),
                truncate_length=self.truncate_length,
            )

        for node_idx1, node_idx2, join_legs1, join_legs2 in progress_reporter.iterate(
            traces, f"Tracing {len(traces)} legs", len(traces)
        ):
            if verbose:
                print(
                    f"==== trace {node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )
                print(
                    f"Total legs left to join: "
                    f"{sum(len(legs) for legs in self._legs_left_to_join.values())}"
                )
            node1_pte = self._ptes[node_idx1]
            node2_pte = self._ptes[node_idx2]

            # print(f"PTEs: {node1_pte}, {node2_pte}")
            # check that the length of the tensor is a power of 4

            if node1_pte == node2_pte:
                # both nodes are in the same PTE!
                if verbose:
                    print(f"self trace within PTE {node1_pte}")
                pte = node1_pte.self_trace(
                    join_legs1=[
                        (node_idx1, leg) if isinstance(leg, int) else leg
                        for leg in join_legs1
                    ],
                    join_legs2=[
                        (node_idx2, leg) if isinstance(leg, int) else leg
                        for leg in join_legs2
                    ],
                    progress_reporter=progress_reporter,
                    verbose=verbose,
                )
                for node_idx in pte.nodes:
                    self._ptes[node_idx] = pte
                self._legs_left_to_join[node_idx1] = [
                    leg
                    for leg in self._legs_left_to_join[node_idx1]
                    if leg not in join_legs1
                ]
                self._legs_left_to_join[node_idx2] = [
                    leg
                    for leg in self._legs_left_to_join[node_idx2]
                    if leg not in join_legs2
                ]
            else:
                if verbose:
                    print(f"MERGING two components {node1_pte} and {node2_pte}")
                    print(f"node1_pte {node1_pte}:")
                    for k in list(node1_pte.tensor.keys()):
                        v = node1_pte.tensor[k]
                        print(Pauli.to_str(*k), end=" ")
                        print(v)
                    print(f"node2_pte {node2_pte}:")
                    for k in list(node2_pte.tensor.keys()):
                        v = node2_pte.tensor[k]
                        print(Pauli.to_str(*k), end=" ")
                        print(v)
                pte = node1_pte.merge_with(
                    node2_pte,
                    join_legs1=[
                        (node_idx1, leg) if isinstance(leg, int) else leg
                        for leg in join_legs1
                    ],
                    join_legs2=[
                        (node_idx2, leg) if isinstance(leg, int) else leg
                        for leg in join_legs2
                    ],
                    verbose=verbose,
                    progress_reporter=progress_reporter,
                )

                for node_idx in pte.nodes:
                    self._ptes[node_idx] = pte
                self._legs_left_to_join[node_idx1] = [
                    leg
                    for leg in self._legs_left_to_join[node_idx1]
                    if leg not in join_legs1
                ]
                self._legs_left_to_join[node_idx2] = [
                    leg
                    for leg in self._legs_left_to_join[node_idx2]
                    if leg not in join_legs2
                ]

            node1_pte = self._ptes[node_idx1]

            if verbose:
                print(
                    f"PTE nodes: {node1_pte.nodes if node1_pte is not None else None}"
                )
                print(
                    f"PTE tracable legs: "
                    f"{node1_pte.tracable_legs if node1_pte is not None else None}"
                )
            if verbose:
                print("PTE tensor: ")
            for k in list(node1_pte.tensor.keys() if node1_pte is not None else []):
                v = node1_pte.tensor[k] if node1_pte is not None else UnivariatePoly()
                # if not 0 in v:
                #     continue
                if verbose:
                    print(Pauli.to_str(*k), end=" ")
                    print(v, end="")
                if self.truncate_length is None:
                    continue
                if v.minw()[0] > self.truncate_length:
                    del pte.tensor[k]
                    if verbose:
                        print(" -- removed")
                else:
                    pte.tensor[k].truncate_inplace(self.truncate_length)
                    if verbose:
                        print(" -- truncated")
            if verbose:
                print(f"PTEs: {self._ptes}")

        if verbose:
            print("summed legs: ", summed_legs)
            print("PTEs: ", self._ptes)
        if len(set(self._ptes.values())) > 1:
            if verbose:
                print(
                    f"tensoring {len(set(self._ptes.values()))} disjoint PTEs: {self._ptes}"
                )

            pte_list = list(set(self._ptes.values()))
            pte = pte_list[0]
            for pte2 in pte_list[1:]:
                pte = pte.tensor_product(
                    pte2, verbose=verbose, progress_reporter=progress_reporter
                )

        if len(pte.tensor) > 1:
            if verbose:
                print(f"final PTE is a tensor: {pte}")
                if len(pte.tensor) > 5000:
                    print(
                        f"There are {len(pte.tensor)} keys in the final PTE, skipping printing."
                    )
                else:
                    for k in list(pte.tensor.keys()):
                        v = pte.tensor[k]
                        if verbose:
                            print(Pauli.to_str(*k), end=" ")
                            print(v)

            self._wep = pte.ordered_key_tensor(
                open_legs,
                progress_reporter=progress_reporter,
                verbose=verbose,
            )
        else:
            self._wep = pte.tensor[()]
            if verbose:
                print(f"final scalar wep: {self._wep}")
            self._wep = self._wep.normalize(verbose=verbose)
            if verbose:
                print(f"final normalized scalar wep: {self._wep}")
        return self._wep

    def stabilizer_enumerator(
        self,
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
    ) -> Dict[int, int]:
        """Compute the stabilizer weight enumerator.

        Computes the weight enumerator polynomial and returns it as a dictionary
        mapping weights to coefficients. This is a convenience method that
        calls stabilizer_enumerator_polynomial() and extracts the dictionary.

        Args:
            verbose: If True, print verbose output.
            progress_reporter: Progress reporter for tracking computation.

        Returns:
            Dict[int, int]: Weight enumerator as a dictionary mapping weights to counts.
        """
        wep = self.stabilizer_enumerator_polynomial(
            verbose=verbose, progress_reporter=progress_reporter
        )
        assert isinstance(wep, UnivariatePoly)
        return wep.dict

    def set_truncate_length(self, truncate_length: int) -> None:
        """Set the truncation length for weight enumerator polynomials.

        Sets the maximum weight to keep in weight enumerator polynomials.
        This affects all subsequent computations and resets any cached results.

        Args:
            truncate_length: Maximum weight to keep in enumerator polynomials.
        """
        self.truncate_length = truncate_length
        self._reset_wep(keep_cot=True)


class _PartiallyTracedEnumerator:
    def __init__(
        self,
        nodes: Set[TensorId],
        tracable_legs: List[TensorLeg],
        tensor: Dict[TensorEnumeratorKey, UnivariatePoly],
        truncate_length: Optional[int],
    ):
        self.nodes: Set[TensorId] = nodes
        self.tracable_legs: List[TensorLeg] = tracable_legs
        self.tensor: Dict[TensorEnumeratorKey, UnivariatePoly] = tensor

        tensor_key_length = (
            len(list(self.tensor.keys())[0]) if len(self.tensor) > 0 else 0
        )
        assert tensor_key_length == len(
            tracable_legs
        ), f"tensor keys of length {tensor_key_length} != {len(tracable_legs)} (len tracable legs)"
        self.truncate_length: Optional[int] = truncate_length

    def __str__(self) -> str:
        return f"PartiallyTracedEnumerator[nodes={self.nodes}, tracable_legs={self.tracable_legs}]"

    def __repr__(self) -> str:
        return f"PartiallyTracedEnumerator[nodes={self.nodes}, tracable_legs={self.tracable_legs}]"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, _PartiallyTracedEnumerator):
            return False
        return self.nodes == other.nodes

    def __hash__(self) -> int:
        return hash((frozenset(self.nodes)))

    def ordered_key_tensor(
        self,
        open_legs: Sequence[TensorLeg],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
    ) -> TensorEnumerator:
        """Reorder the tensor keys to match the specified open legs order.

        Reindexes the tensor dictionary to match the order of the specified
        open legs. This is useful when the tensor needs to be used with
        a different leg ordering.

        Args:
            open_legs: The desired order of open legs.
            verbose: If True, print reindexing information.
            progress_reporter: Progress reporter for tracking the reindexing.

        Returns:
            TensorEnumerator: Tensor with reordered keys.
        """
        if self.tracable_legs == open_legs:
            return self.tensor
        index = [self.tracable_legs.index(leg) for leg in open_legs]

        if verbose:
            print("Need to reindex tracable legs: ")
            print(f"open_legs: {open_legs}, tracable_legs: {self.tracable_legs}")
            print(f"index: {index}")

        def reindex(key: TensorEnumeratorKey) -> TensorEnumeratorKey:
            return tuple(key[i] for i in index)

        return {
            reindex(k): v
            for k, v in progress_reporter.iterate(
                iterable=self.tensor.items(),
                desc=f"Reindexing keys in tensor for {len(self.tensor)} elements",
                total_size=len(list(self.tensor.items())),
            )
        }

    def tensor_product(
        self,
        other: "_PartiallyTracedEnumerator",
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
    ) -> "_PartiallyTracedEnumerator":
        """Compute the tensor product with another partially traced enumerator.

        Creates a new partially traced enumerator that represents the tensor
        product of this enumerator with another one. The resulting enumerator
        combines the nodes and tracable legs from both enumerators.

        Args:
            other: The other partially traced enumerator to tensor with.
            verbose: If True, print tensor product details.
            progress_reporter: Progress reporter for tracking the operation.

        Returns:
            _PartiallyTracedEnumerator: The tensor product of the two enumerators.
        """
        if verbose:
            print(f"tensoring {self}")
            for k, v in self.tensor.items():
                print(f"{k}: {v}")
            print(f"with {other}")
            for k, v in other.tensor.items():
                print(f"{k}: {v}")
        new_tensor: Dict[TensorEnumeratorKey, UnivariatePoly] = {}
        for k1 in progress_reporter.iterate(
            iterable=self.tensor.keys(),
            desc=f"PTE tensor product: {len(self.tensor)} x {len(other.tensor)} elements",
            total_size=len(list(self.tensor.keys())),
        ):
            for k2 in other.tensor.keys():
                k = tuple(k1) + tuple(k2)
                new_tensor[k] = self.tensor[k1] * other.tensor[k2]
                self.truncate_if_needed(k, new_tensor)

        return _PartiallyTracedEnumerator(
            self.nodes.union(other.nodes),
            tracable_legs=self.tracable_legs + other.tracable_legs,
            tensor=new_tensor,
            truncate_length=self.truncate_length,
        )

    def merge_with(
        self,
        pte2: "_PartiallyTracedEnumerator",
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ) -> "_PartiallyTracedEnumerator":
        """Merge this enumerator with another by contracting specified legs.

        Merges two partially traced enumerators by contracting the specified
        legs between them. This corresponds to a tensor contraction operation
        between the two enumerators.

        Args:
            pte2: The other partially traced enumerator to merge with.
            join_legs1: Legs from this enumerator to contract.
            join_legs2: Legs from the other enumerator to contract.
            progress_reporter: Progress reporter for tracking the merge.
            verbose: If True, print merge details.

        Returns:
            _PartiallyTracedEnumerator: The merged enumerator.
        """
        assert len(join_legs1) == len(join_legs2)

        wep: Dict[TensorEnumeratorKey, UnivariatePoly] = defaultdict(UnivariatePoly)
        open_legs1 = [leg for leg in self.tracable_legs if leg not in join_legs1]
        open_legs2 = [leg for leg in pte2.tracable_legs if leg not in join_legs2]

        join_indices1 = [self.tracable_legs.index(leg) for leg in join_legs1]
        join_indices2 = [pte2.tracable_legs.index(leg) for leg in join_legs2]

        kept_indices1 = [
            i for i, leg in enumerate(self.tracable_legs) if leg in open_legs1
        ]
        kept_indices2 = [
            i for i, leg in enumerate(pte2.tracable_legs) if leg in open_legs2
        ]

        if verbose:
            print(
                f"PTE merge: {len(self.tensor)} x {len(pte2.tensor)} elements,"
                f"legs: {len(self.tracable_legs)},{len(pte2.tracable_legs)}"
            )

        for k1 in progress_reporter.iterate(
            iterable=self.tensor.keys(),
            desc=(
                f"PTE merge: {len(self.tensor)} x {len(pte2.tensor)} elements,"
                f"legs: {len(self.tracable_legs)},{len(pte2.tracable_legs)}"
            ),
            total_size=len(list(self.tensor.keys())),
        ):
            for k2 in pte2.tensor.keys():
                if not all(
                    k1[i1] == k2[i2] for i1, i2 in zip(join_indices1, join_indices2)
                ):
                    continue

                wep1 = self.tensor[k1]
                wep2 = pte2.tensor[k2]

                # we have to cut off the join legs from both keys and concatenate them
                key = tuple(k1[i] for i in kept_indices1) + tuple(
                    k2[i] for i in kept_indices2
                )

                wep[key].add_inplace(wep1 * wep2)
                self.truncate_if_needed(key, wep)

        tracable_legs = [
            (idx, leg) if isinstance(leg, int) else leg for idx, leg in open_legs1
        ]
        tracable_legs += [
            (idx, leg) if isinstance(leg, int) else leg for idx, leg in open_legs2
        ]

        return _PartiallyTracedEnumerator(
            self.nodes.union(pte2.nodes),
            tracable_legs=tracable_legs,
            tensor=wep,
            truncate_length=self.truncate_length,
        )

    def self_trace(
        self,
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ) -> "_PartiallyTracedEnumerator":
        """Perform self-tracing by contracting pairs of legs within this enumerator.

        Contracts pairs of legs within the same partially traced enumerator,
        effectively performing a partial trace operation. The legs are paired
        up and contracted together.

        Args:
            join_legs1: First set of legs to contract.
            join_legs2: Second set of legs to contract.
            progress_reporter: Progress reporter for tracking the operation.
            verbose: If True, print trace details.

        Returns:
            _PartiallyTracedEnumerator: New enumerator with contracted legs removed.
        """
        assert len(join_legs1) == len(join_legs2)

        wep: Dict[TensorEnumeratorKey, UnivariatePoly] = defaultdict(UnivariatePoly)
        open_legs = [
            leg
            for leg in self.tracable_legs
            if leg not in join_legs1 and leg not in join_legs2
        ]

        if verbose:
            print(f"[self_trace] traceable legs: {self.tracable_legs} <- {open_legs}")
        join_indices1 = [self.tracable_legs.index(leg) for leg in join_legs1]

        if verbose:
            print(f"[self_trace] join indices1: {join_indices1}")
        join_indices2 = [self.tracable_legs.index(leg) for leg in join_legs2]
        if verbose:
            print(f"[self_trace] join indices2: {join_indices2}")

        kept_indices = [
            i for i, leg in enumerate(self.tracable_legs) if leg in open_legs
        ]
        if verbose:
            print(f"[self_trace] kept indices: {kept_indices}")

        for old_key in progress_reporter.iterate(
            iterable=self.tensor.keys(),
            desc=(
                f"PTE ({len(self.tracable_legs)} tracable legs) self trace on {len(self.tensor)}"
                "elements"
            ),
            total_size=len(list(self.tensor.keys())),
        ):
            if not all(
                old_key[i1] == old_key[i2]
                for i1, i2 in zip(join_indices1, join_indices2)
            ):
                continue

            wep1 = self.tensor[old_key]

            # we have to cut off the join legs from both keys and concatenate them

            key = tuple(old_key[i] for i in kept_indices)

            assert len(key) == len(
                open_legs
            ), f"key length: {len(key)} != {len(open_legs)}"
            # print(f"key: {key}")
            # print(f"wep: {wep1}")

            wep[key].add_inplace(wep1)

            self.truncate_if_needed(key, wep)
        tracable_legs = list(open_legs)

        return _PartiallyTracedEnumerator(
            self.nodes,
            tracable_legs=tracable_legs,
            tensor=wep,
            truncate_length=self.truncate_length,
        )

    def truncate_if_needed(
        self, key: TensorEnumeratorKey, wep: Dict[TensorEnumeratorKey, UnivariatePoly]
    ) -> None:
        """Truncate the weight enumerator polynomial if it exceeds the truncation length.

        Checks if the weight corresponding to the given key exceeds the truncation
        length and removes it from the weight enumerator polynomial if so.

        Args:
            key: The tensor enumerator key to check.
            wep: The weight enumerator polynomial dictionary to potentially modify.
        """
        if self.truncate_length is not None:
            if wep[key].minw()[0] > self.truncate_length:
                del wep[key]
            else:
                wep[key].truncate_inplace(self.truncate_length)
