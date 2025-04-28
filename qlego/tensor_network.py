from collections import defaultdict
from copy import deepcopy
from typing_extensions import deprecated
import cotengra as ctg

from typing import Any, Callable, Iterable, List, Dict, Optional, Set, Tuple, Union
from galois import GF2
import numpy as np
import sympy
from tqdm import tqdm

from qlego.legos import LegoAnnotation, Legos
from qlego.linalg import gauss
from qlego.parity_check import conjoin, self_trace, sprint, sstr, tensor_product
from qlego.progress_reporter import DummyProgressReporter, ProgressReporter
from qlego.simple_poly import SimplePoly
from qlego.stabilizer_tensor_enumerator import (
    StabilizerCodeTensorEnumerator,
    _index_leg,
    _index_legs,
)
from qlego.symplectic import omega, sconcat, sslice, weight


PAULI_I = GF2([0, 0])
PAULI_X = GF2([1, 0])
PAULI_Z = GF2([0, 1])
PAULI_Y = GF2([1, 1])


class TensorNetwork:
    def __init__(
        self,
        nodes: Union[
            Iterable["StabilizerCodeTensorEnumerator"],
            Dict[Any, "StabilizerCodeTensorEnumerator"],
        ],
        truncate_length=None,
    ):

        if isinstance(nodes, dict):
            for k, v in nodes.items():
                if k != v.idx:
                    raise ValueError(
                        f"Nodes dict passed in with inconsitent indexing, {k} != {v.idx} for {v}."
                    )
            self.nodes: Dict[Any, "StabilizerCodeTensorEnumerator"] = nodes
        else:
            nodes_dict = {node.idx: node for node in nodes}
            if len(nodes_dict) < len(nodes):
                raise ValueError(f"There are colliding index values of nodes: {nodes}")
            self.nodes = nodes_dict

        self.traces = []
        self._cot_tree = None
        self._cot_traces = None

        self.legs_left_to_join = {idx: [] for idx in self.nodes.keys()}
        # self.open_legs = [n.legs for n in self.nodes]

        self._wep = None
        self.ptes: Dict[int, _PartiallyTracedEnumerator] = {}
        self._coset = None
        self.truncate_length = truncate_length

    def __eq__(self, other: "TensorNetwork") -> bool:
        """Compare two TensorNetworks for equality."""
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
            if self.nodes[idx].truncate_length != other.nodes[idx].truncate_length:
                return False

        # Compare traces - convert only the hashable parts to tuples
        def trace_to_comparable(trace):
            node_idx1, node_idx2, join_legs1, join_legs2 = trace
            return (node_idx1, node_idx2, tuple(join_legs1), tuple(join_legs2))

        self_traces = {trace_to_comparable(t) for t in self.traces}
        other_traces = {trace_to_comparable(t) for t in other.traces}

        if self_traces != other_traces:
            return False

        return True

    def __hash__(self) -> int:
        """Generate hash for TensorNetwork."""
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
                    node.truncate_length,
                )
            )

        # Hash the traces - convert only the hashable parts to tuples
        def trace_to_hashable(trace):
            node_idx1, node_idx2, join_legs1, join_legs2 = trace
            return (node_idx1, node_idx2, tuple(join_legs1), tuple(join_legs2))

        traces_hash = hash(tuple(sorted(trace_to_hashable(t) for t in self.traces)))

        return nodes_hash ^ traces_hash

    def construction_code(self) -> str:
        """Returns Python code that will recreate this TensorNetwork instance."""
        code = []

        # Import statements would go at top of file
        code.append(
            "from qlego.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator"
        )
        code.append("from qlego.tensor_network import TensorNetwork")
        code.append("from galois import GF2")
        code.append("")

        # Create nodes dict
        code.append("nodes = {}")
        for idx, node in self.nodes.items():
            matrix_str = f"GF2({str(node.h.tolist())})"
            code.append(f"nodes[{repr(idx)}] = StabilizerCodeTensorEnumerator(")
            code.append(f"    h={matrix_str},")
            code.append(f"    idx={repr(idx)},")
            if node.legs != [(idx, leg) for leg in range(node.n)]:
                code.append(f"    legs={repr(node.legs)},")
            if node.coset_flipped_legs:
                code.append(f"    coset_flipped_legs={repr(node.coset_flipped_legs)},")
            if node.truncate_length is not None:
                code.append(f"    truncate_length={node.truncate_length},")
            code.append(")")

        code.append("")
        code.append("# Create TensorNetwork")
        code.append(
            f"tn = TensorNetwork(nodes, truncate_length={repr(self.truncate_length)})"
        )

        # Add traces
        if self.traces:
            code.append("")
            code.append("# Add traces")
            for node1, node2, legs1, legs2 in self.traces:
                code.append(
                    f"tn.self_trace({repr(node1)}, {repr(node2)}, {repr([l[1] for l in legs1])}, {repr([l[1] for l in legs2])})"
                )

        return "\n".join(code)

    def qubit_to_node_and_leg(self, q: int):
        raise NotImplementedError(
            f"qubit_to_node_and_leg() is not implemented for {type(self)}!"
        )

    def n_qubits(self):
        raise NotImplementedError(f"n_qubits() is not implemented for {type(self)}")

    def _reset_wep(self, keep_cot=False):

        self._wep = None

        prev_traces = deepcopy(self.traces)
        self.traces = []
        self.legs_left_to_join = {idx: [] for idx in self.nodes.keys()}

        for trace in prev_traces:
            self.self_trace(trace[0], trace[1], [trace[2][0]], [trace[3][0]])

        self.ptes: Dict[int, _PartiallyTracedEnumerator] = {}
        self._coset = None

        if keep_cot:
            self._cot_tree = None
            self._cot_traces = None

    def set_coset(self, coset_error: GF2):
        """Sets the coset_error to the tensornetwork.

        The coset_error should follow the qubit numbering defined in tn.qubit_to_node which maps the index to a node ID.
        If this is not setup, a ValueError is raised. It is assumed that this TN is built from [[5,1,2]] or [[6,0,2]] legos (or one of their X or Z only variants),
        and the coset is applied on leg 4 (the logical leg) at the moment. This will fail on the Tanner graph TN, we'll have to figure that one out next (TODO).
        """

        self._reset_wep(keep_cot=True)

        if isinstance(coset_error, tuple):
            self._coset = GF2.Zeros(2 * self.n_qubits())
            for i in coset_error[0]:
                self._coset[i] = 1
            for i in coset_error[1]:
                self._coset[i + self.n_qubits()] = 1
        elif coset_error is None:
            self._coset = GF2.Zeros(2 * self.n)
        else:
            assert isinstance(
                coset_error, GF2
            ), f"coset error neither tuple, None or GF2, {coset_error}"
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

    def self_trace(self, node_idx1, node_idx2, join_leg1, join_leg2):
        if self._wep is not None:
            raise ValueError(
                "Tensor network weight enumerator is already traced no new tracing schedule is allowed."
            )
        join_leg1 = _index_legs(node_idx1, join_leg1)
        join_leg2 = _index_legs(node_idx2, join_leg2)

        # print(f"adding trace {node_idx1, node_idx2, join_legs1, join_legs2}")
        self.traces.append((node_idx1, node_idx2, join_leg1, join_leg2))

        self.legs_left_to_join[node_idx1] += join_leg1
        self.legs_left_to_join[node_idx2] += join_leg2

    def traces_to_dot(self):
        print("-----")
        # print(self.open_legs)
        # for n, legs in enumerate(self.open_legs):
        #     for leg in legs:
        #         print(f"n{n} -> n{n}_{leg}")

        for node_idx1, node_idx2, join_legs1, join_legs2 in self.traces:
            for leg1, leg2 in zip(join_legs1, join_legs2):
                print(f"n{node_idx1} -> n{node_idx2} ")

    def _cotengra_tree_from_traces(self, free_legs, leg_indices, index_to_legs):
        inputs, output, size_dict, input_names = self._prep_cotengra_inputs(
            leg_indices, free_legs, True
        )

        path = []
        terms = [{node_idx} for node_idx in input_names]

        def idx(node_id):
            for i, term in enumerate(terms):
                if node_id in term:
                    return i
            assert (
                False
            ), "This should not happen, nodes should be always present in at least one of the terms."

        for node_idx1, node_idx2, join_legs1, join_legs2 in self.traces:
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
        self, cotengra: bool = False, each_step=False, details=False, **cotengra_opts
    ):
        free_legs, leg_indices, index_to_legs = self._collect_legs()
        tree = None

        node_to_free_legs = defaultdict(list)
        for leg in free_legs:
            for node_idx, node in self.nodes.items():
                if leg in node.legs:
                    node_to_free_legs[node.idx].append(leg)

        new_tn = TensorNetwork(deepcopy(self.nodes))

        new_tn.traces = deepcopy(self.traces)
        if cotengra:
            print("Calculating best contraction path...")
            new_tn.traces, tree = self._cotengra_contraction(
                free_legs, leg_indices, index_to_legs, details, True, **cotengra_opts
            )
        else:
            tree = self._cotengra_tree_from_traces(
                free_legs, leg_indices, index_to_legs
            )

        new_tn.legs_left_to_join = deepcopy(self.legs_left_to_join)

        pte_nodes = dict()
        max_pte_legs = 0
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
            f"    Total legs to trace: {sum(len(legs) for legs in new_tn.legs_left_to_join.values())}"
        )
        pte_leg_numbers = defaultdict(int)

        for node_idx1, node_idx2, join_legs1, join_legs2 in new_tn.traces:
            if each_step:
                print(
                    f"==== trace { node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )

            for leg in join_legs1:
                new_tn.legs_left_to_join[node_idx1].remove(leg)
            for leg in join_legs2:
                new_tn.legs_left_to_join[node_idx2].remove(leg)

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
                for node in pte_nodes.keys():
                    if pte_nodes[node] == removed_pte:
                        pte_nodes[node] = merged_pte

            if details:
                print(f"    pte nodes: {pte_nodes}")
            if each_step:
                print(
                    f"    Total legs to trace: {sum(len(legs) for legs in new_tn.legs_left_to_join.values())}"
                )

            pte_leg_numbers = defaultdict(int)

            for node in pte_nodes.keys():
                pte_leg_numbers[pte_nodes[node]] += len(new_tn.legs_left_to_join[node])

            if each_step:
                print(f"     PTEs num tracable legs: {dict(pte_leg_numbers)}")

            biggest_legs = max(pte_leg_numbers.values())

            max_pte_legs = max(max_pte_legs, biggest_legs)
            if each_step:
                print(f"    Biggest PTE legs: {biggest_legs} vs MAX: {max_pte_legs}")

        print("=== Final state ==== ")
        if details:
            print(f"pte nodes: {pte_nodes}")

        print(
            f"all nodes {set(pte_nodes.keys()) == set(new_tn.nodes.keys())} and all nodes are in a single PTE: {len(set(pte_nodes.values())) == 1}"
        )
        print(
            f"Total legs to trace: {sum(len(legs) for legs in new_tn.legs_left_to_join.values())}"
        )
        print(f"PTEs num tracable legs: {dict(pte_leg_numbers)}")
        print(f"Maximum PTE legs: {max_pte_legs}")
        return tree, max_pte_legs

    def conjoin_nodes(
        self,
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
    ) -> "StabilizerCodeTensorEnumerator":
        # If there's only one node and no traces, return it directly
        if len(self.nodes) == 1 and len(self.traces) == 0:
            return list(self.nodes.values())[0]

        # Map from node_idx to the index of its PTE in ptes list
        nodes = list(self.nodes.values())
        ptes: List[Tuple[StabilizerCodeTensorEnumerator, Set[str]]] = [
            (node, {node.idx}) for node in nodes
        ]
        node_to_pte = {node.idx: i for i, node in enumerate(nodes)}

        for node_idx1, node_idx2, join_legs1, join_legs2 in progress_reporter.iterate(
            self.traces, "Conjoining nodes", len(self.traces)
        ):
            if verbose:
                print(
                    f"==== trace {node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )

            join_legs1 = _index_legs(node_idx1, join_legs1)
            join_legs2 = _index_legs(node_idx2, join_legs2)

            pte1_idx = node_to_pte.get(node_idx1)
            pte2_idx = node_to_pte.get(node_idx2)

            # Case 1: Both nodes are in the same PTE
            if pte1_idx == pte2_idx:
                if verbose:
                    print(
                        f"Self trace in PTE containing both {node_idx1} and {node_idx2}"
                    )
                pte, nodes = ptes[pte1_idx]
                new_pte = pte.self_trace(join_legs1, join_legs2)
                ptes[pte1_idx] = (new_pte, nodes)

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
                for node in nodes2:
                    node_to_pte[node] = pte1_idx
                # Adjust indices for all nodes in PTEs after the removed one
                for node, pte_idx in node_to_pte.items():
                    if pte_idx > pte2_idx:
                        node_to_pte[node] = pte_idx - 1

            if verbose:
                print("H:")
                sprint(ptes[0][0].h)

        # If we have multiple components at the end, tensor them together
        if len(ptes) > 1:
            for other in ptes[1:]:
                ptes[0] = (ptes[0][0].tensor_with(other[0]), ptes[0][1].union(other[1]))

        return ptes[0][0]

    def _collect_legs(self):
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

    def _prep_cotengra_inputs(self, leg_indices, free_legs, verbose=False):
        inputs = []
        output = []  #  tuple(leg_indices[leg] for leg in free_legs)
        size_dict = {leg: 2 for leg in leg_indices.values()}

        input_names = []

        for node_idx, node in self.nodes.items():
            inputs.append(tuple(leg_indices[leg] for leg in node.legs))
            input_names.append(node_idx)
            if verbose:
                # Print the indices for each node
                for leg in node.legs:
                    print(
                        f"  Leg {leg}: Index {leg_indices[leg]} {'OPEN' if leg in free_legs else 'traced'}"
                    )
        if verbose:
            print(input_names)
            print(inputs)
            print(output)
            print(size_dict)
        return inputs, output, size_dict, input_names

    def _traces_from_cotengra_tree(
        self, tree: ctg.ContractionTree, index_to_legs, inputs
    ):
        def legs_to_contract(l: frozenset, r: frozenset):
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
        for parent, l, r in tree.traverse():
            # at each step we have to find the nodes that share indices in the two merged subsets
            new_traces = legs_to_contract(l, r)
            traces += new_traces

        trace_indices = []
        for t in traces:
            assert t in self.traces, f"{t} not in traces. Traces: {self.traces}"
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

    def _cotengra_contraction(
        self,
        free_legs,
        leg_indices,
        index_to_legs,
        verbose=False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        **cotengra_opts,
    ):

        if self._cot_traces is not None:
            return self._cot_traces, self._cot_tree

        inputs, output, size_dict, input_names = self._prep_cotengra_inputs(
            leg_indices, free_legs, verbose
        )

        contengra_params = {
            "minimize": "size",
            "parallel": False,
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

    def stabilizer_enumerator_polynomial(
        self,
        open_legs: List[Tuple[int, int]] = [],
        verbose: bool = False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        cotengra: bool = True,
    ) -> SimplePoly:
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
        traces = self.traces
        if cotengra:
            traces, _ = self._cotengra_contraction(
                free_legs, leg_indices, index_to_legs, verbose, progress_reporter
            )
        summed_legs = [leg for leg in free_legs if leg not in open_legs]
        if self._wep is not None:
            return self._wep

        if len(self.traces) == 0 and len(self.nodes) == 1:
            return list(self.nodes.items())[0][1].stabilizer_enumerator_polynomial(
                verbose=verbose, progress_reporter=progress_reporter
            )

        parity_check_enums = {}

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
            tensor = node.stabilizer_enumerator_polynomial(
                open_legs=traced_legs,
                verbose=verbose,
                progress_reporter=progress_reporter,
            )
            if len(traced_legs) == 0:
                tensor = {(): tensor}
            self.ptes[node_idx] = _PartiallyTracedEnumerator(
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
                    f"==== trace { node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )
                print(
                    f"Total legs left to join: {sum(len(legs) for legs in self.legs_left_to_join.values())}"
                )
            node1_pte = None if node_idx1 not in self.ptes else self.ptes[node_idx1]
            node2_pte = None if node_idx2 not in self.ptes else self.ptes[node_idx2]

            # print(f"PTEs: {node1_pte}, {node2_pte}")

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
                for node in pte.nodes:
                    self.ptes[node] = pte
                self.legs_left_to_join[node_idx1] = [
                    leg
                    for leg in self.legs_left_to_join[node_idx1]
                    if leg not in join_legs1
                ]
                self.legs_left_to_join[node_idx2] = [
                    leg
                    for leg in self.legs_left_to_join[node_idx2]
                    if leg not in join_legs2
                ]
            else:
                if verbose:
                    print(f"MERGING two components {node1_pte} and {node2_pte}")
                    print(f"node1_pte {node1_pte}:")
                    for k in list(node1_pte.tensor.keys()):
                        v = node1_pte.tensor[k]
                        sprint(GF2([k]), end=" ")
                        print(v)
                    print(f"node2_pte {node2_pte}:")
                    for k in list(node2_pte.tensor.keys()):
                        v = node2_pte.tensor[k]
                        sprint(GF2([k]), end=" ")
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

                for node in pte.nodes:
                    self.ptes[node] = pte
                self.legs_left_to_join[node_idx1] = [
                    leg
                    for leg in self.legs_left_to_join[node_idx1]
                    if leg not in join_legs1
                ]
                self.legs_left_to_join[node_idx2] = [
                    leg
                    for leg in self.legs_left_to_join[node_idx2]
                    if leg not in join_legs2
                ]

            node1_pte = None if node_idx1 not in self.ptes else self.ptes[node_idx1]

            if verbose:
                print(f"PTE nodes: {node1_pte.nodes}")
                print(f"PTE tracable legs: {node1_pte.tracable_legs}")
            if verbose:
                print("PTE tensor: ")
            for k in list(node1_pte.tensor.keys()):
                v = node1_pte.tensor[k]
                # if not 0 in v:
                #     continue
                if verbose:
                    sprint(GF2([k]), end=" ")
                    print(v, end="")
                if self.truncate_length is None:
                    if verbose:
                        print()
                    continue
                if v.minw()[0] > self.truncate_length:
                    del pte.tensor[k]
                    if verbose:
                        print(" -- removed")
                else:
                    if v.leading_order_poly() != v:
                        if verbose:
                            print(" -- truncated")
                        pte.tensor[k] = v.leading_order_poly()
                    else:
                        if verbose:
                            print()
            if verbose:
                print(f"PTEs: {self.ptes}")

        if verbose:
            print("summed legs: ", summed_legs)
            print("PTEs: ", self.ptes)
        if len(set(self.ptes.values())) > 1:
            if verbose:
                print(
                    f"tensoring { len(set(self.ptes.values()))} disjoint PTEs: {self.ptes}"
                )

            pte_list = list(set(self.ptes.values()))
            pte = pte_list[0]
            for pte2 in pte_list[1:]:
                pte = pte.tensor_product(pte2, verbose=verbose)

        if len(pte.tensor) > 1:
            if verbose:
                print(f"final PTE is a tensor: {pte}")
                for k in list(pte.tensor.keys()):
                    v = pte.tensor[k]
                    if verbose:
                        sprint(GF2([k]), end=" ")
                        print(v)

            self._wep = pte.ordered_key_tensor(open_legs)
            # self._wep = SimplePoly()
            # for k, sub_wep in pte.tensor.items():
            #     self._wep.add_inplace(sub_wep * SimplePoly({weight(GF2(k)): 1}))
        else:
            self._wep = pte.tensor[()]
            if verbose:
                print(f"final scalar wep: {self._wep}")
            self._wep = self._wep.normalize(verbose=verbose)
        return self._wep

    def stabilizer_enumerator(
        self,
        verbose=False,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
    ):
        wep = self.stabilizer_enumerator_polynomial(
            verbose=verbose, progress_reporter=progress_reporter
        )
        return wep._dict

    def set_truncate_length(self, truncate_length):
        self.truncate_length = truncate_length
        for node in self.nodes.values():
            node.truncate_length = truncate_length
        self._reset_wep(keep_cot=True)


class _PartiallyTracedEnumerator:
    def __init__(
        self,
        nodes: Set[int],
        tracable_legs: List[Tuple[int, int]],
        tensor: Dict[Tuple, SimplePoly],
        truncate_length: int,
    ):
        self.nodes = nodes
        self.tracable_legs = tracable_legs
        self.tensor = tensor

        tensor_key_length = (
            len(list(self.tensor.keys())[0]) if len(self.tensor) > 0 else 0
        )
        assert tensor_key_length == 2 * len(
            tracable_legs
        ), f"tensor keys of length {tensor_key_length} != {2 * len(tracable_legs)} (2 * len tracable legs)"
        self.truncate_length = truncate_length

    def __str__(self):
        return f"PartiallyTracedEnumerator[nodes={self.nodes}, tracable_legs={self.tracable_legs}]"

    def __repr__(self):
        return f"PartiallyTracedEnumerator[nodes={self.nodes}, tracable_legs={self.tracable_legs}]"

    def __eq__(self, other):
        if not isinstance(other, _PartiallyTracedEnumerator):
            return False
        return self.nodes == other.nodes

    def __hash__(self):
        return hash((frozenset(self.nodes)))

    def ordered_key_tensor(self, open_legs: List[Tuple[int, int]]):
        print(f"open_legs: {open_legs}, tracable_legs: {self.tracable_legs}")
        reindex = lambda key: tuple(
            sslice(
                GF2(key), [self.tracable_legs.index(leg) for leg in open_legs]
            ).tolist()
        )

        return {reindex(k): v for k, v in self.tensor.items()}

    def stabilizer_enumerator(self, legs: List[Tuple[int, int]], e):
        filtered_axes = [self.tracable_legs.index(leg) for leg in legs]
        indices = [slice(None) for _ in range(self.tracable_legs)]
        for idx, axis in enumerate(filtered_axes):
            indices[axis] = int(e[idx])

        return self.tensor[indices]

    def tensor_product(self, other, verbose=False):
        if verbose:
            print(f"tensoring {self}")
            for k, v in self.tensor.items():
                print(f"{k}: {v}")
            print(f"with {other}")
            for k, v in other.tensor.items():
                print(f"{k}: {v}")
        new_tensor = {}
        for k1 in self.tensor.keys():
            for k2 in other.tensor.keys():
                new_tensor[tuple(sconcat(k1, k2))] = self.tensor[k1] * other.tensor[k2]

        return _PartiallyTracedEnumerator(
            self.nodes.union(other.nodes),
            tracable_legs=self.tracable_legs + other.tracable_legs,
            tensor=new_tensor,
            truncate_length=self.truncate_length,
        )

    def merge_with(
        self,
        pte2,
        join_legs1,
        join_legs2,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ):
        assert len(join_legs1) == len(join_legs2)

        wep = defaultdict(lambda: SimplePoly())
        open_legs1 = [leg for leg in self.tracable_legs if leg not in join_legs1]

        open_legs2 = [leg for leg in pte2.tracable_legs if leg not in join_legs2]

        # print(f"traceable legs: {self.tracable_legs} <- {open_legs}")
        join_indices1 = [self.tracable_legs.index(leg) for leg in join_legs1]

        # print(f"join indices1: {join_indices1}")
        join_indices2 = [pte2.tracable_legs.index(leg) for leg in join_legs2]
        # print(f"join indices2: {join_indices2}")

        kept_indices1 = [
            i for i, leg in enumerate(self.tracable_legs) if leg in open_legs1
        ]
        kept_indices2 = [
            i for i, leg in enumerate(pte2.tracable_legs) if leg in open_legs2
        ]
        # print(f"kept indices: {kept_indices}")

        for k1 in progress_reporter.iterate(
            iterable=self.tensor.keys(),
            desc=f"PTE merge: {len(self.tensor)} x {len(pte2.tensor)} elements, legs: {len(self.tracable_legs)},{len(pte2.tracable_legs)}",
            total_size=len(list(self.tensor.keys())),
        ):
            k1_gf2 = GF2(k1)
            for k2 in pte2.tensor.keys():
                k2_gf2 = GF2(k2)
                if not np.array_equal(
                    sslice(k1_gf2, join_indices1),
                    sslice(k2_gf2, join_indices2),
                ):
                    continue

                wep1 = self.tensor[k1]
                wep2 = pte2.tensor[k2]

                # we have to cut off the join legs from both keys and concatenate them
                key = tuple(
                    sconcat(
                        sslice(k1_gf2, kept_indices1),
                        sslice(k2_gf2, kept_indices2),
                    ).tolist()
                )

                # assert len(key[0]) == 2 * (
                #     len(open_legs1) + len(open_legs2)
                # ), f"key length: {len(key[0])} != 2*({len(open_legs1)}  + {len(open_legs2)}) = {2 * (
                #     len(open_legs1) + len(open_legs2)
                # )}"
                # print(f"key: {key}")
                # print(f"wep1: {wep1}")
                # print(f"wep2: {wep2}")
                wep[key].add_inplace(wep1 * wep2)

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
        join_legs1,
        join_legs2,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ):
        assert len(join_legs1) == len(join_legs2)
        join_length = len(join_legs1)

        wep = defaultdict(SimplePoly)
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
            desc=f"PTE ({len(self.tracable_legs)} tracable legs) self trace on {len(self.tensor)} elements",
            total_size=len(list(self.tensor.keys())),
        ):
            if not np.array_equal(
                sslice(GF2(old_key), join_indices1),
                sslice(GF2(old_key), join_indices2),
            ):
                continue

            wep1 = self.tensor[old_key]

            k1_gf2 = GF2(old_key)

            # we have to cut off the join legs from both keys and concatenate them

            key = tuple(sslice(k1_gf2, kept_indices).tolist())

            assert len(key) == 2 * (
                len(open_legs)
            ), f"key length: {len(key)} != 2*{len(open_legs)} = {2 * len(open_legs)}"
            # print(f"key: {key}")
            # print(f"wep: {wep1}")

            wep[key].add_inplace(wep1)
        tracable_legs = [(idx, leg) for idx, leg in open_legs]

        return _PartiallyTracedEnumerator(
            self.nodes,
            tracable_legs=tracable_legs,
            tensor=wep,
            truncate_length=self.truncate_length,
        )

    def truncate_if_needed(self, key, wep):
        if self.truncate_length is not None:
            if np.count_nonzero(key) + wep[key].minw()[0] > self.truncate_length:
                del wep[key]
