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

import abc
from collections import defaultdict
from copy import deepcopy
from enum import Enum
from typing import (
    Any,
    Callable,
    Dict,
    Iterable,
    List,
    Optional,
    Sequence,
    Set,
    Tuple,
    Union,
)
import numpy as np
from galois import GF2

import cotengra as ctg
from cotengra.scoring import ensure_basic_quantities_are_computed
from sympy import false

from planqtn.contraction_visitors.contraction_visitor import ContractionVisitor
from planqtn.contraction_visitors.max_size_cost_visitor import max_tensor_size_cost
from planqtn.contraction_visitors.stabilizer_flops_cost_fn import (
    custom_flops_cost_stabilizer_codes,
)
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
    _index_leg,
    _index_legs,
)
from planqtn.tensor import TensorId, TensorLeg, TensorEnumerator, TensorEnumeratorKey
from planqtn.tracable import Tracable, Trace


class ContractionType(Enum):
    COTENGRA_SPARSE_STABILIZER_SIZE = 0
    COTENGRA_SPARSE_STABILIZER_FLOPS = 1
    COTENGRA_DEFAULT_SIZE = 2
    COTENGRA_FROM_TRACES = 3


class Contraction[T: Tracable]:
    """A contraction of a tensor network.

    This class encompasses all the intermediate states and allows for a contraction to be performed,
    while maintaining the intermediate partially traced objects, which might be for weight enume-
    rators or parity check matrices for example.
    """

    def __init__(
        self,
        tn: "TensorNetwork",
        initialize_node: Callable[[StabilizerCodeTensorEnumerator], T],
        cotengra_tree: Optional[ctg.ContractionTree] = None,
    ):
        self.tn = tn
        self.nodes: Dict[TensorId, StabilizerCodeTensorEnumerator] = deepcopy(tn.nodes)
        self.traces: List[Trace] = deepcopy(tn._traces)
        print("self.nodes: ")
        for node_id, node in self.nodes.items():
            print(node_id, node, node.open_legs)

        self.pte_list: List[Tuple[T, Set[TensorId]]] = [
            (initialize_node(node), {node_id}) for node_id, node in self.nodes.items()
        ]
        self.node_to_pte = {
            list(node_ids)[0]: i for i, (_, node_ids) in enumerate(self.pte_list)
        }

        if cotengra_tree is not None:
            self._cot_tree = cotengra_tree
        else:
            self._cot_tree = None

    def _init_tree(
        self,
        use_cotengra: bool = True,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ) -> None:
        with progress_reporter.enter_phase("collecting legs"):
            free_legs, leg_indices, index_to_legs = self._collect_legs()

        inputs, _, _, _ = self._prep_cotengra_inputs(leg_indices, free_legs, verbose)
        # TODO: if the tree is preset, then we need to verify that the inputs are compatible?

        # TODO: do I need this?
        # for node_idx, leg_index in open_legs:
        #     open_legs_per_node[node_idx].append(_index_leg(node_idx, leg_index))

        if self._cot_tree is None:
            if use_cotengra and len(self.nodes) > 0 and len(self.traces) > 0:

                with progress_reporter.enter_phase("cotengra contraction"):
                    self._cot_tree = self._cotengra_tree(
                        free_legs,
                        leg_indices,
                        index_to_legs,
                        verbose,
                        progress_reporter,
                    )
            else:
                self._cot_tree = self._cotengra_tree_from_traces(
                    free_legs, leg_indices, self.traces
                )

        def legs_to_contract(l: frozenset, r: frozenset) -> List[Trace]:
            res = []
            left_indices = sum((list(inputs[leaf_idx]) for leaf_idx in l), [])
            right_indices = sum((list(inputs[leaf_idx]) for leaf_idx in r), [])
            for idx1 in left_indices:
                if idx1 in right_indices:
                    (node_idx1, leg1), (node_idx2, leg2) = index_to_legs[idx1]
                    res.append((node_idx1, node_idx2, leg1, leg2))
            return res

        open_legs_for_contraction = [
            legs_to_contract(l, r) for _, l, r in self._cot_tree.traverse()
        ]

        return open_legs_for_contraction

    def contract(
        self,
        visitors: Optional[List[ContractionVisitor]] = None,
        cotengra: bool = True,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        open_legs: Sequence[TensorLeg] = (),
        verbose: bool = False,
    ) -> T:
        assert (
            progress_reporter is not None
        ), "Progress reporter must be provided, it is None"

        if len(self.traces) == 0 and len(self.nodes) == 1:
            return self.pte_list[0][0]

        # We convert the tree back to a list of traces
        all_open_legs_to_contract = self._init_tree(
            use_cotengra=cotengra, verbose=verbose, progress_reporter=progress_reporter
        )
        tree_len = self._cot_tree.N

        for open_legs_to_contract in progress_reporter.iterate(
            all_open_legs_to_contract, f"Tracing {tree_len} nodes", tree_len
        ):
            print("legs to contract: ", open_legs_to_contract)
            if len(open_legs_to_contract) == 0:
                continue
            pte_ids = {
                self.node_to_pte[node_idx1]
                for node_idx1, _, _, _ in open_legs_to_contract
            }.union(
                {
                    self.node_to_pte[node_idx2]
                    for _, node_idx2, _, _ in open_legs_to_contract
                }
            )
            assert len(pte_ids) == 2, f"Expected 2 PTEs, got {len(pte_ids)}"
            pte1_idx, pte2_idx = pte_ids
            join_legs1 = []
            join_legs2 = []

            node_join_legs = defaultdict(list)

            for node_idx1, node_idx2, leg1, leg2 in open_legs_to_contract:
                node_join_legs[node_idx1].append(leg1)
                node_join_legs[node_idx2].append(leg2)

                if node_idx1 in self.pte_list[pte1_idx][1]:
                    join_legs1.append(leg1)
                else:
                    join_legs2.append(leg1)

                if node_idx2 in self.pte_list[pte2_idx][1]:
                    join_legs2.append(leg2)
                else:
                    join_legs1.append(leg2)

            if verbose:
                print(
                    f"==== trace {self.pte_list[pte1_idx], self.pte_list[pte2_idx], join_legs1, join_legs2} ==== "
                )

            if verbose:
                print(f"Merging PTEs containing {node_idx1} and {node_idx2}")
            pte1, nodes1 = self.pte_list[pte1_idx]
            pte2, nodes2 = self.pte_list[pte2_idx]
            merged_nodes = nodes1.union(nodes2)

            new_pte = pte1.merge_with(
                pte2, join_legs1, join_legs2, progress_reporter, verbose
            )

            for node_idx in new_pte.node_ids:
                self.node_to_pte[node_idx] = pte1_idx

            # Update the first PTE with merged result
            self.pte_list[pte1_idx] = (new_pte, merged_nodes)
            # Remove the second PTE
            self.pte_list.pop(pte2_idx)

            # Update node_to_pte mappings
            for node_idx in nodes2:
                self.node_to_pte[node_idx] = pte1_idx
            # Adjust indices for all nodes in PTEs after the removed one
            for node_idx, pte_idx in self.node_to_pte.items():
                if pte_idx > pte2_idx:
                    self.node_to_pte[node_idx] = pte_idx - 1

                for visitor in visitors or []:
                    visitor.on_merge(
                        pte1,
                        pte2,
                        join_legs1,
                        join_legs2,
                        new_pte,
                    )
        if len(self.pte_list) > 1:
            for other in self.pte_list[1:]:
                self.pte_list[0] = (
                    self.pte_list[0][0].tensor_with(
                        other[0], progress_reporter, verbose
                    ),
                    self.pte_list[0][1].union(other[1]),
                )

        return self.pte_list[0][0]

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
                for node_idx1, node_idx2, join_legs1, join_legs2 in self.traces:
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

    def _cotengra_tree(
        self,
        free_legs: List[TensorLeg],
        leg_indices: Dict[TensorLeg, str],
        index_to_legs: Dict[str, List[Tuple[TensorId, TensorLeg]]],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        **cotengra_opts: Any,
    ) -> ctg.ContractionTree:

        inputs, output, size_dict, _ = self._prep_cotengra_inputs(
            leg_indices, free_legs, verbose
        )
        stabilizer_flops_fn = self._make_flops_cost_fn(index_to_legs, inputs)

        contengra_params = {
            "minimize": stabilizer_flops_fn,
            "parallel": False,
            # kahypar is not installed by default, but if user has it they can use it by default
            # otherwise, our default is greedy right now
            "optlib": "cmaes",
            "methods": ["greedy"],
            "on_trial_error": "raise",
        }

        if cotengra_opts.get("minimize") == "custom_flops":
            cotengra_opts["minimize"] = stabilizer_flops_fn
        elif cotengra_opts.get("minimize") == "custom_max_size":
            stabilizer_max_size_fn = self._make_max_size_cost_fn(index_to_legs, inputs)
            cotengra_opts["minimize"] = stabilizer_max_size_fn

        contengra_params.update(cotengra_opts)
        opt = ctg.HyperOptimizer(
            **contengra_params,
            progbar=not isinstance(progress_reporter, DummyProgressReporter),
        )

        return opt.search(inputs, output, size_dict)

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
            assert t in self.traces, f"{t} not in traces. Traces: {self._traces}"
            idx = self.traces.index(t)
            trace_indices.append(idx)

        assert set(trace_indices) == set(
            range(len(self.traces))
        ), "Some traces are missing from cotengra tree\n" + "\n".join(
            [
                str(self.traces[i])
                for i in set(range(len(self.traces))) - set(trace_indices)
            ]
        )
        return traces

    def _make_flops_cost_fn(
        self,
        index_to_legs: Dict[str, List[Tuple[TensorId, TensorLeg]]],
        inputs: List[Tuple[str, ...]],
    ) -> Callable[[Dict], float]:
        def stabilizer_cost_fn(trial_dict: Dict[str, Any]) -> float:
            tree = trial_dict["tree"]
            ensure_basic_quantities_are_computed(trial_dict)

            return float(np.log2(custom_flops_cost_stabilizer_codes(self.tn)))

        return stabilizer_cost_fn

    def _make_max_size_cost_fn(
        self,
        index_to_legs: Dict[str, List[Tuple[TensorId, TensorLeg]]],
        inputs: List[Tuple[str, ...]],
    ) -> Callable[[Dict], float]:
        def max_size_cost_fn(trial_dict: Dict[str, Any]) -> float:
            tree = trial_dict["tree"]
            ensure_basic_quantities_are_computed(trial_dict)

            return float(np.log2(max_tensor_size_cost(self.tn)))

        return max_size_cost_fn

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
        tree = None

        new_tn = TensorNetwork(deepcopy(self.nodes))

        # pylint: disable=W0212
        new_tn._traces = deepcopy(self._traces)
        if cotengra:

            new_tn._traces, tree = self._cotengra_tree(
                free_legs,
                leg_indices,
                index_to_legs,
                details,
                TqdmProgressReporter() if details else DummyProgressReporter(),
                **cotengra_opts,
            )
        else:
            tree = self._cotengra_tree_from_traces(free_legs, leg_indices)

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

        pte_leg_numbers: Dict[TensorId, int] = defaultdict(int)

        for node_idx1, node_idx2, join_legs1, join_legs2 in new_tn._traces:
            if each_step:
                print(
                    f"==== trace {node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )

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

            pte_leg_numbers = defaultdict(int)

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

            print(f"PTEs num tracable legs: {dict(pte_leg_numbers)}")
            print(f"Maximum PTE legs: {max_pte_legs}")
        return tree, max_pte_legs

    def _cotengra_tree_from_traces(
        self,
        free_legs: List[TensorLeg],
        leg_indices: Dict[TensorLeg, str],
        traces: List[Trace],
    ) -> ctg.ContractionTree:

        inputs, output, size_dict, input_names = self._prep_cotengra_inputs(
            leg_indices, free_legs, True
        )

        path = []
        terms = [{node_idx} for node_idx in input_names]

        def idx(node_id: TensorId) -> int:
            for i, term in enumerate(terms):
                if str(node_id) in term:
                    return i
            assert False, (
                "This should not happen, nodes should be always present in at least one of the "
                f"terms, but could not find node_id: {node_id} in {terms}"
            )

        for node_idx1, node_idx2, _, _ in traces:
            i, j = sorted([idx(node_idx1), idx(node_idx2)])
            # print((node_idx1, node_idx2), f"=> {i,j}", terms)
            if i == j:
                continue
            path.append({i, j})
            term2 = terms.pop(j)
            term1 = terms.pop(i)
            terms.append(term1.union(term2))
        return ctg.ContractionTree.from_path(
            inputs,
            output,
            size_dict,
            path=path,
            check=True,
            autocomplete=True,
        )


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
        self._wep: Optional[TensorEnumerator | UnivariatePoly] = None
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
        self._coset = GF2.Zeros(2 * self.n_qubits())

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
        print(
            "adding trace: ",
            node_idx1,
            node_idx2,
            join_legs1_indexed,
            join_legs2_indexed,
        )

        assert (
            set(join_legs1_indexed).intersection(set(self.nodes[node_idx1].open_legs))
            == set()
        ), f"Legs in {join_legs1_indexed} are already open for node {node_idx1} with open legs {self.nodes[node_idx1].open_legs}"
        assert (
            set(join_legs2_indexed).intersection(set(self.nodes[node_idx2].open_legs))
            == set()
        ), f"Legs in {join_legs2_indexed} are already open for node {node_idx2} with open legs {self.nodes[node_idx2].open_legs}"

        self.nodes[node_idx1].open_legs = self.nodes[node_idx1].open_legs + tuple(
            join_legs1_indexed
        )
        self.nodes[node_idx2].open_legs = self.nodes[node_idx2].open_legs + tuple(
            join_legs2_indexed
        )
        print(
            "open legs: ",
            self.nodes[node_idx1].open_legs,
            self.nodes[node_idx2].open_legs,
        )

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

    def conjoin_nodes(
        self,
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        visitors: Optional[List[ContractionVisitor]] = None,
        open_legs: Sequence[TensorLeg] = (),
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

        contraction = Contraction(
            self,
            lambda node: node.copy(),
        )

        return contraction.contract(
            cotengra=False,
            progress_reporter=progress_reporter,
            open_legs=open_legs,
            verbose=verbose,
            visitors=visitors,
        )

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

        #  if verbose:
        #                 print(f"PTE nodes: {pte.nodes if pte is not None else None}")
        #                 print(
        #                     f"PTE tracable legs: "
        #                     f"{pte.tracable_legs if pte is not None else None}"
        #                 )
        #             if verbose:
        #                 print("PTE tensor: ")
        #             for k in list(pte.tensor.keys() if pte is not None else []):
        #                 v = pte.tensor[k] if pte is not None else UnivariatePoly()
        #                 # if not 0 in v:
        #                 #     continue
        #                 if verbose:
        #                     print(Pauli.to_str(*k), end=" ")
        #                     print(v, end="")
        #                 if self.truncate_length is None:
        #                     continue
        #                 if v.minw()[0] > self.truncate_length:
        #                     del pte.tensor[k]
        #                     if verbose:
        #                         print(" -- removed")
        #                 else:
        #                     pte.tensor[k].truncate_inplace(self.truncate_length)
        #                     if verbose:
        #                         print(" -- truncated")

        contraction = Contraction(
            self,
            lambda node: _PartiallyTracedEnumerator.from_stabilizer_code_tensor_enumerator(
                node, self.truncate_length, verbose, progress_reporter, open_legs
            ),
        )

        final_tensor = contraction.contract(
            cotengra=cotengra,
            progress_reporter=progress_reporter,
            open_legs=open_legs,
            verbose=verbose,
        )

        # # parity_check_enums = {}

        # for _, l, r in progress_reporter.iterate(
        #     self._cot_tree.traverse(), f"Tracing {tree_len} nodes", tree_len
        # ):

        #     # print(f"PTEs: {node1_pte}, {node2_pte}")
        #     # check that the length of the tensor is a power of 4

        #     if verbose:
        #         print(f"MERGING two components {node1_pte} and {node2_pte}")
        #         print(f"node1_pte {node1_pte}:")
        #         for k in list(node1_pte.tensor.keys()):
        #             v = node1_pte.tensor[k]
        #             print(Pauli.to_str(*k), end=" ")
        #             print(v)
        #         print(f"node2_pte {node2_pte}:")
        #         for k in list(node2_pte.tensor.keys()):
        #             v = node2_pte.tensor[k]
        #             print(Pauli.to_str(*k), end=" ")
        #             print(v)
        #     pte = node1_pte.merge_with(
        #         node2_pte,
        #         join_legs1=join_legs1,
        #         join_legs2=join_legs2,
        #         verbose=verbose,
        #         progress_reporter=progress_reporter,
        #     )

        # if verbose:
        #     print(f"PTEs: {self._ptes}")

        # if verbose:
        #     print("summed legs: ", summed_legs)
        #     print("PTEs: ", self._ptes)
        # if len(set(self._ptes.values())) > 1:
        #     if verbose:
        #         print(
        #             f"tensoring {len(set(self._ptes.values()))} disjoint PTEs: {self._ptes}"
        #         )

        #     pte_list = list(set(self._ptes.values()))
        #     pte = pte_list[0]
        #     for pte2 in pte_list[1:]:
        #         pte = pte.tensor_product(
        #             pte2, verbose=verbose, progress_reporter=progress_reporter
        #         )

        if len(final_tensor.tensor) > 1:
            if verbose:
                print(f"final PTE is a tensor: {final_tensor}")
                if len(final_tensor.tensor) > 5000:
                    print(
                        f"There are {len(final_tensor.tensor)} keys in the final PTE, skipping printing."
                    )
                else:
                    for k in list(final_tensor.tensor.keys()):
                        v = final_tensor.tensor[k]
                        if verbose:
                            print(Pauli.to_str(*k), end=" ")
                            print(v)

            self._wep = final_tensor.ordered_key_tensor(
                open_legs,
                progress_reporter=progress_reporter,
                verbose=verbose,
            )
        else:
            self._wep = final_tensor.tensor[()]
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
        node_ids: Set[TensorId],
        tracable_legs: List[TensorLeg],
        tensor: Dict[TensorEnumeratorKey, UnivariatePoly],
        truncate_length: Optional[int],
    ):
        self.node_ids: Set[TensorId] = node_ids
        self.tracable_legs: List[TensorLeg] = tracable_legs
        self.tensor: Dict[TensorEnumeratorKey, UnivariatePoly] = tensor

        tensor_key_length = (
            len(list(self.tensor.keys())[0]) if len(self.tensor) > 0 else 0
        )
        assert tensor_key_length == len(
            tracable_legs
        ), f"tensor keys of length {tensor_key_length} != {len(tracable_legs)} (len tracable legs)"
        self.truncate_length: Optional[int] = truncate_length

    @classmethod
    def from_stabilizer_code_tensor_enumerator(
        cls,
        node: StabilizerCodeTensorEnumerator,
        truncate_length: Optional[int],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        open_legs: Sequence[TensorLeg] = (),
    ) -> "_PartiallyTracedEnumerator":
        node_open_legs = node.open_legs + tuple(
            leg for leg in node.legs if leg not in node.open_legs and leg in open_legs
        )
        tensor = node.stabilizer_enumerator_polynomial(
            open_legs=node_open_legs,
            verbose=verbose,
            progress_reporter=progress_reporter,
            truncate_length=truncate_length,
        )
        if isinstance(tensor, UnivariatePoly):
            tensor = {(): tensor}
        return cls(
            node_ids={node.tensor_id},
            tracable_legs=node_open_legs,
            tensor=tensor,
            truncate_length=truncate_length,
        )

    def __str__(self) -> str:
        return f"PartiallyTracedEnumerator[nodes={self.node_ids}, tracable_legs={self.tracable_legs}]"

    def __repr__(self) -> str:
        return f"PartiallyTracedEnumerator[nodes={self.node_ids}, tracable_legs={self.tracable_legs}]"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, _PartiallyTracedEnumerator):
            return False
        return self.node_ids == other.node_ids

    def __hash__(self) -> int:
        return hash((frozenset(self.node_ids)))

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
            self.node_ids.union(other.node_ids),
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
            self.node_ids.union(pte2.node_ids),
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
