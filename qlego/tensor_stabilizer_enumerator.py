from collections import defaultdict
from copy import deepcopy
import cotengra as ctg

from typing import Any, Callable, Iterable, List, Dict, Set, Tuple, Union
from galois import GF2
import numpy as np
import sympy
from tqdm import tqdm

from qlego.legos import Legos
from qlego.linalg import gauss
from qlego.parity_check import conjoin, self_trace, sprint
from qlego.scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from qlego.simple_poly import SimplePoly
from qlego.symplectic import omega, weight


PAULI_I = GF2([0, 0])
PAULI_X = GF2([1, 0])
PAULI_Z = GF2([0, 1])
PAULI_Y = GF2([1, 1])


def _index_leg(idx, leg):
    return (idx, leg) if isinstance(leg, int) else leg


def _index_legs(idx, legs):
    if legs is not None and isinstance(legs, Iterable):
        return [_index_leg(idx, leg) for leg in legs]
    return legs


def sslice(op, indices):
    n = len(op) // 2

    if isinstance(indices, list | np.ndarray):
        if len(indices) == 0:
            return GF2([])
        indices = np.array(indices)
        return GF2(np.concatenate([op[indices], op[indices + n]]))
    elif isinstance(indices, slice):
        x = slice(
            0 if indices.start is None else indices.start,
            n if indices.stop is None else indices.stop,
        )

        z = slice(x.start + n, x.stop + n)
        return GF2(np.concatenate([op[x], op[z]]))


def _suboperator_matches_on_support(support, op, subop):
    if len(support) == 0:
        return len(subop) == 0
    m = len(support)
    n = len(op) // 2
    support = np.array(support)
    return (
        # Xs equal
        np.array_equal(op[support], subop[:m])
        and
        # Zs equal
        np.array_equal(op[support + n], subop[m:])
    )


def _equal_on_support(support, op1, op2):
    n1 = len(op1) // 2
    n2 = len(op2) // 2
    support = np.array(support)
    return (
        # Xs equal
        np.array_equal(op1[support], op2[support])
        and
        # Zs equal
        np.array_equal(op1[support + n1], op2[support + n2])
    )


def replace_with_op_on_indices(indices, op, target):
    """replaces target's operations with op

    op should have self.m number of qubits, target should have self.n qubits.
    """
    m = len(indices)
    n = len(op) // 2

    res = target.copy()
    res[indices] = op[:m]
    res[np.array(indices) + n] = op[m:]
    return res


def sconcat(*ops):
    ns = [len(op) // 2 for op in ops]
    return np.hstack(
        [  # X part
            np.concatenate([op[:n] for n, op in zip(ns, ops)]),
            # Z part
            np.concatenate([op[n:] for n, op in zip(ns, ops)]),
        ]
    )


class TensorNetwork:
    def __init__(
        self,
        nodes: Union[
            Iterable["TensorStabilizerCodeEnumerator"],
            Dict[Any, "TensorStabilizerCodeEnumerator"],
        ],
        truncate_length=None,
    ):

        if isinstance(nodes, dict):
            for k, v in nodes.items():
                if k != v.idx:
                    raise ValueError(
                        f"Nodes dict passed in with inconsitent indexing, {k} != {v.idx} for {v}."
                    )
            self.nodes: Dict[Any, "TensorStabilizerCodeEnumerator"] = nodes
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
        self.ptes: Dict[int, PartiallyTracedEnumerator] = {}
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
            "from qlego.tensor_stabilizer_enumerator import TensorNetwork, TensorStabilizerCodeEnumerator"
        )
        code.append("from qlego.utils import GF2")
        code.append("")

        # Create nodes dict
        code.append("nodes = {}")
        for idx, node in self.nodes.items():
            matrix_str = f"GF2({str(node.h.tolist())})"
            code.append(f"nodes[{repr(idx)}] = TensorStabilizerCodeEnumerator(")
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

        self.ptes: Dict[int, PartiallyTracedEnumerator] = {}
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
        self, verbose: bool = False, progress_bar: bool = False
    ) -> "TensorStabilizerCodeEnumerator":
        # If there's only one node and no traces, return it directly
        if len(self.nodes) == 1 and len(self.traces) == 0:
            return list(self.nodes.values())[0]

        # Map from node_idx to the index of its PTE in ptes list
        node_to_pte = {}
        # List of (pte, node_indices) tuples, where pte is TensorStabilizerCodeEnumerator
        # and node_indices is the set of nodes in that connected component
        ptes = []

        prog = lambda x: x if not progress_bar else tqdm(x, leave=False)
        for node_idx1, node_idx2, join_legs1, join_legs2 in prog(self.traces):
            if verbose:
                print(
                    f"==== trace {node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )

            join_legs1 = _index_legs(node_idx1, join_legs1)
            join_legs2 = _index_legs(node_idx2, join_legs2)

            pte1_idx = node_to_pte.get(node_idx1)
            pte2_idx = node_to_pte.get(node_idx2)

            # Case 1: Neither node is in any PTE - create new PTE
            if pte1_idx is None and pte2_idx is None:
                if verbose:
                    print(f"Creating new PTE with nodes {node_idx1} and {node_idx2}")
                new_pte = self.nodes[node_idx1].conjoin(
                    self.nodes[node_idx2], legs1=join_legs1, legs2=join_legs2
                )
                ptes.append((new_pte, {node_idx1, node_idx2}))
                new_pte_idx = len(ptes) - 1
                node_to_pte[node_idx1] = new_pte_idx
                node_to_pte[node_idx2] = new_pte_idx

            # Case 2: First node is in a PTE, second is not
            elif pte1_idx is not None and pte2_idx is None:
                if verbose:
                    print(f"Adding {node_idx2} to PTE containing {node_idx1}")
                pte, nodes = ptes[pte1_idx]
                new_pte = pte.conjoin(
                    self.nodes[node_idx2], legs1=join_legs1, legs2=join_legs2
                )
                nodes.add(node_idx2)
                ptes[pte1_idx] = (new_pte, nodes)
                node_to_pte[node_idx2] = pte1_idx

            # Case 3: Second node is in a PTE, first is not
            elif pte1_idx is None and pte2_idx is not None:
                if verbose:
                    print(f"Adding {node_idx1} to PTE containing {node_idx2}")
                pte, nodes = ptes[pte2_idx]
                new_pte = pte.conjoin(
                    self.nodes[node_idx1], legs1=join_legs2, legs2=join_legs1
                )
                nodes.add(node_idx1)
                ptes[pte2_idx] = (new_pte, nodes)
                node_to_pte[node_idx1] = pte2_idx

            # Case 4: Both nodes are in the same PTE
            elif pte1_idx == pte2_idx:
                if verbose:
                    print(
                        f"Self trace in PTE containing both {node_idx1} and {node_idx2}"
                    )
                pte, nodes = ptes[pte1_idx]
                new_pte = pte.self_trace(join_legs1, join_legs2)
                ptes[pte1_idx] = (new_pte, nodes)

            # Case 5: Nodes are in different PTEs - merge them
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

        # If we have multiple components at the end, merge them all
        if len(ptes) > 1:
            raise ValueError(
                "Multiple disconnected components in the tensor network. This is not supported yet."
            )

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
        ), "Some traces are missing!"
        return traces

    def _cotengra_contraction(
        self,
        free_legs,
        leg_indices,
        index_to_legs,
        verbose=False,
        progress_bar=False,
        **cotengra_opts,
    ):

        if self._cot_traces is not None:
            return self._cot_traces, self._cot_tree

        inputs, output, size_dict, input_names = self._prep_cotengra_inputs(
            leg_indices, free_legs, verbose
        )

        contengra_params = {
            "minimize": "size",
            "parallel": True,
        }
        contengra_params.update(cotengra_opts)
        opt = ctg.HyperOptimizer(
            **contengra_params,
            progbar=progress_bar,
        )

        self._cot_tree = opt.search(inputs, output, size_dict)

        self._cot_traces = self._traces_from_cotengra_tree(
            self._cot_tree, index_to_legs=index_to_legs, inputs=inputs
        )

        return self._cot_traces, self._cot_tree

    def stabilizer_enumerator_polynomial(
        self,
        legs: List[Tuple[int, int]] = [],
        e: GF2 = None,
        eprime: GF2 = None,
        verbose: bool = False,
        progress_bar: bool = False,
        summed_legs: List[Tuple[int, int]] = None,
        cotengra: bool = True,
    ) -> SimplePoly:
        free_legs, leg_indices, index_to_legs = self._collect_legs()
        traces = self.traces
        if cotengra:
            traces, _ = self._cotengra_contraction(
                free_legs, leg_indices, index_to_legs, verbose, progress_bar
            )
        if summed_legs is None:
            summed_legs = free_legs
        if self._wep is not None:
            return self._wep
        m = len(legs)
        node_legs_to_trace = {node: [] for node in self.nodes.keys()}
        for op_idx, (node, leg) in enumerate(legs):
            node_legs_to_trace[node].append((leg, op_idx))

        # default to the identity
        if e is None:
            e = GF2.Zeros(2 * m)
        if eprime is None:
            eprime = e.copy()
        assert len(e) == m * 2
        assert len(eprime) == m * 2

        node1_pte = None
        if len(self.traces) == 0 and len(self.nodes) == 1:
            return list(self.nodes.items())[0][1].stabilizer_enumerator_polynomial()

        if len(self.traces) == 0 and len(self.nodes) > 1:
            raise ValueError(
                "Completely disconnected nodes is unsupported. TODO: implement tensoring of disconnected component weight enumerators."
            )

        prog = lambda x: (
            x
            if not progress_bar
            else tqdm(x, leave=False, desc=f"{len(traces)} traces")
        )
        for node_idx1, node_idx2, join_legs1, join_legs2 in prog(traces):
            if verbose:
                print(
                    f"==== trace { node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )
                print(
                    f"Total legs left to join: {sum(len(legs) for legs in self.legs_left_to_join.values())}"
                )

            traced_legs_with_op_indices1 = node_legs_to_trace[node_idx1]
            traced_legs1 = [l for l, idx in traced_legs_with_op_indices1]
            e1_indices = [idx for l, idx in traced_legs_with_op_indices1]
            e1 = sslice(e, e1_indices)
            eprime1 = sslice(eprime, e1_indices)

            assert len(e1) == len(eprime1)

            traced_legs_with_op_indices2 = node_legs_to_trace[node_idx2]
            traced_legs2 = [l for l, idx in traced_legs_with_op_indices2]
            e2_indices = [idx for l, idx in traced_legs_with_op_indices2]
            e2 = sslice(e, e2_indices)
            eprime2 = sslice(eprime, e2_indices)

            assert len(e2) == len(eprime2)

            t2 = self.nodes[node_idx2]

            node1_pte = None if node_idx1 not in self.ptes else self.ptes[node_idx1]
            node2_pte = None if node_idx2 not in self.ptes else self.ptes[node_idx2]

            # print(f"PTEs: {node1_pte}, {node2_pte}")

            if node1_pte is None and node2_pte is None:
                t1: TensorStabilizerCodeEnumerator = self.nodes[node_idx1]
                open_legs1 = [
                    leg
                    for leg in self.nodes[node_idx1].legs
                    if leg not in join_legs1 and leg not in summed_legs
                ]
                open_legs2 = [
                    leg
                    for leg in self.nodes[node_idx2].legs
                    if leg not in join_legs2
                    and leg not in traced_legs2
                    and leg not in summed_legs
                ]

                if verbose:
                    print(
                        f"joining two nodes with open legs: {open_legs1}, {open_legs2}"
                    )

                pte = t1.trace_with(
                    t2,
                    join_legs1=join_legs1,
                    join_legs2=join_legs2,
                    traced_legs1=traced_legs1,
                    traced_legs2=traced_legs2,
                    e1=e1,
                    eprime1=eprime1,
                    e2=e2,
                    eprime2=eprime2,
                    open_legs1=open_legs1,
                    open_legs2=open_legs2,
                )
                self.legs_left_to_join[node_idx1] = open_legs1
                self.legs_left_to_join[node_idx2] = open_legs2

                self.ptes[node_idx1] = pte
                self.ptes[node_idx2] = pte

            elif (node1_pte is None and node2_pte is not None) or (
                node2_pte is None and node1_pte is not None
            ):
                if node1_pte is None:
                    # print("swapping...")

                    # swap node 1 and 2 so node 1 is in the PTE
                    join_legs1, join_legs2 = join_legs2, join_legs1
                    node_idx1, node_idx2 = node_idx2, node_idx1
                    node1_pte, node2_pte = node2_pte, node1_pte
                    t2 = self.nodes[node_idx2]
                    # print(
                    #     f"==== trace { node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                    # )

                if verbose:
                    print(f"PTE open legs: {len(node1_pte.tracable_legs)}")
                    print(f"Node {node_idx2}: {len(self.legs_left_to_join[node_idx2])}")
                open_legs1 = [
                    leg
                    for leg in node1_pte.tracable_legs
                    if leg not in join_legs1
                    and leg not in join_legs2
                    and leg not in summed_legs
                ]
                # print(f"open_legs for node1: {open_legs1}, {join_legs1} ")
                open_legs2 = [
                    leg
                    for leg in self.nodes[node_idx2].legs
                    if leg not in join_legs2
                    and leg not in traced_legs2
                    and leg not in summed_legs
                ]
                # print(f"open legs for node2: {open_legs2}")
                pte = node1_pte.trace_with(
                    t2,
                    join_legs1=[
                        (node_idx1, leg) if isinstance(leg, int) else leg
                        for leg in join_legs1
                    ],
                    join_legs2=join_legs2,
                    traced_legs=traced_legs2,
                    e=e2,
                    eprime=eprime2,
                    open_legs1=open_legs1,
                    open_legs2=open_legs2,
                    progress_bar=progress_bar,
                )
                for node in pte.nodes:
                    self.ptes[node] = pte

                self.legs_left_to_join[node_idx1] = [
                    leg
                    for leg in self.legs_left_to_join[node_idx1]
                    if leg not in join_legs1
                ]
                self.legs_left_to_join[node_idx2] = open_legs2
            elif node1_pte == node2_pte:
                # both nodes are in the same PTE!
                pte = node1_pte.self_trace(
                    join_legs1=[
                        (node_idx1, leg) if isinstance(leg, int) else leg
                        for leg in join_legs1
                    ],
                    join_legs2=[
                        (node_idx2, leg) if isinstance(leg, int) else leg
                        for leg in join_legs2
                    ],
                    progress_bar=progress_bar,
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
                    progress_bar=progress_bar,
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
                if verbose:
                    print(k, v, end="")
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

            # print(f"PTEs: {self.ptes}")

        self._wep = SimplePoly()
        for k, sub_wep in pte.tensor.items():
            self._wep.add_inplace(sub_wep * SimplePoly({weight(GF2(k)): 1}))
        # self._wep = node1_pte.tensor[((), ())]
        return self._wep

    def stabilizer_enumerator(
        self, k, legs: List[Tuple[int, List[int]]], e: GF2 = None, eprime: GF2 = None
    ):
        wep = self.stabilizer_enumerator_polynomial(legs, e, eprime)
        return wep._dict

    def set_truncate_length(self, truncate_length):
        self.truncate_length = truncate_length
        for node in self.nodes.values():
            node.truncate_length = truncate_length
        self._reset_wep(keep_cot=True)


class PartiallyTracedEnumerator:
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
        if not isinstance(other, PartiallyTracedEnumerator):
            return False
        return self.nodes == other.nodes

    def __hash__(self):
        return hash((frozenset(self.nodes)))

    def stabilizer_enumerator(self, legs: List[Tuple[int, int]], e, eprime):
        filtered_axes = [self.tracable_legs.index(leg) for leg in legs]
        indices = [slice(None) for _ in range(self.tracable_legs)]
        for idx, axis in enumerate(filtered_axes[: len(e)]):
            indices[axis] = int(e[idx])

        for idx, axis in enumerate(filtered_axes[len(e) :]):
            indices[axis] = int(eprime[idx])

        return self.tensor[indices]

    def merge_with(self, pte2, join_legs1, join_legs2, progress_bar: bool = False):
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

        def prog(x):
            return (
                x
                if not progress_bar
                else tqdm(
                    x,
                    leave=False,
                    desc=f"PTE merge: {len(self.tensor)} x {len(pte2.tensor)} elements, legs: {len(self.tracable_legs)},{len(pte2.tracable_legs)}",
                )
            )

        for k1 in prog(self.tensor.keys()):
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

        return PartiallyTracedEnumerator(
            self.nodes.union(pte2.nodes),
            tracable_legs=tracable_legs,
            tensor=wep,
            truncate_length=self.truncate_length,
        )

    def truncate_if_needed(self, key, wep):
        if self.truncate_length is not None:
            if np.count_nonzero(key) + wep[key].minw()[0] > self.truncate_length:
                del wep[key]

    def self_trace(self, join_legs1, join_legs2, progress_bar: bool = False):
        assert len(join_legs1) == len(join_legs2)
        join_length = len(join_legs1)

        wep = defaultdict(SimplePoly)
        open_legs = [
            leg
            for leg in self.tracable_legs
            if leg not in join_legs1 and leg not in join_legs2
        ]

        # print(f"traceable legs: {self.tracable_legs} <- {open_legs}")
        join_indices1 = [self.tracable_legs.index(leg) for leg in join_legs1]

        # print(f"join indices1: {join_indices1}")
        join_indices2 = [self.tracable_legs.index(leg) for leg in join_legs2]
        # print(f"join indices2: {join_indices2}")

        kept_indices = [
            i for i, leg in enumerate(self.tracable_legs) if leg in open_legs
        ]
        # print(f"kept indices: {kept_indices}")

        def prog(x):
            return (
                x
                if not progress_bar
                else tqdm(
                    x,
                    leave=False,
                    desc=f"PTE ({len(self.tracable_legs)} tracable legs) self trace on {len(self.tensor)} elements",
                )
            )

        for old_key in prog(self.tensor.keys()):
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

        return PartiallyTracedEnumerator(
            self.nodes,
            tracable_legs=tracable_legs,
            tensor=wep,
            truncate_length=self.truncate_length,
        )

    def trace_with(
        self,
        other: "TensorStabilizerCodeEnumerator",
        join_legs1,
        join_legs2,
        traced_legs,
        e: GF2,
        eprime: GF2,
        open_legs1,
        open_legs2,
        progress_bar: bool = False,
    ) -> "PartiallyTracedEnumerator":

        assert len(join_legs1) == len(join_legs2)

        t2 = other.stabilizer_enumerator_polynomial(
            traced_legs, e, eprime, join_legs2 + open_legs2
        )

        wep = defaultdict(SimplePoly)

        # print(f"traceable legs: {self.tracable_legs} <- {open_legs1}")
        # print(f"join_legs1: {join_legs1}")
        join_indices1 = [self.tracable_legs.index(leg) for leg in join_legs1]

        # print(f"join indices1: {join_indices1}")
        join_indices2 = list(range(len(join_legs2)))
        # print(f"join indices2: {join_indices2}")

        kept_indices1 = [
            i for i, leg in enumerate(self.tracable_legs) if leg in open_legs1
        ]
        # print(f"kept indices 1: {kept_indices1}")
        kept_indices2 = list(range(len(join_legs2), len(join_legs2 + open_legs2)))

        # print(f"kept indices 2: {kept_indices2}")

        def prog(x):
            return (
                x
                if not progress_bar
                else tqdm(
                    x,
                    leave=False,
                    desc=f"PTE with {len(self.tensor)} tensor vs node {other.idx} with {len(t2)} tensor | {join_legs1[0]} - {join_legs2[0]}",
                )
            )

        for k1 in prog(self.tensor.keys()):
            k1_gf2 = GF2(k1)
            for k2 in prog(t2.keys()):
                k2_gf2 = GF2(k2)
                if not np.array_equal(
                    sslice(k1_gf2, join_indices1),
                    sslice(k2_gf2, join_indices2),
                ):
                    continue

                wep1 = self.tensor[k1]
                wep2 = t2[k2]

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
            (other.idx, leg) if isinstance(leg, int) else leg for leg in open_legs2
        ]
        # print("new tracable legs:", tracable_legs)

        return PartiallyTracedEnumerator(
            self.nodes.union({other.idx}),
            tracable_legs=tracable_legs,
            tensor=wep,
            truncate_length=self.truncate_length,
        )


class TensorStabilizerCodeEnumerator:
    """The tensor enumerator from Cao & Lackey"""

    def __init__(
        self,
        h,
        idx=0,
        legs=None,
        coset_flipped_legs: List[Tuple[Tuple[Any, int], GF2]] = None,
        truncate_length=None,
    ):

        self.h = h

        self.idx = idx
        if len(self.h.shape) == 1:
            self.n = self.h.shape[0] // 2
            self.k = self.n - 1
        else:
            self.n = self.h.shape[1] // 2
            self.k = self.n - self.h.shape[0]

        self.legs = [(self.idx, leg) for leg in range(self.n)] if legs is None else legs
        # print(f"Legs: {self.legs} because n = {self.n}, {self.h.shape}")
        assert (
            len(self.legs) == self.n
        ), f"Leg number {len(self.legs)} does not match parity check matrix columns (qubit count) {self.n}"
        # a dict is a wonky tensor - TODO: rephrase this to proper tensor
        self._stabilizer_enums: Dict[sympy.Tuple, SimplePoly] = {}

        self.coset_flipped_legs = []
        if coset_flipped_legs is not None:
            self.coset_flipped_legs = coset_flipped_legs
            for leg, pauli in self.coset_flipped_legs:
                assert (
                    leg in self.legs
                ), f"Leg in coset not found: {leg} - legs: {self.legs}"
                assert len(pauli) == 2 and isinstance(
                    pauli, GF2
                ), f"Invalid pauli in coset: {pauli} on leg {leg}"
            # print(f"Coset flipped legs validated. Setting to {self.coset_flipped_legs}")
        self.truncate_length = truncate_length

    def __str__(self):
        return f"TensorEnum({self.idx})"

    def __repr__(self):
        return f"TensorEnum({self.idx})"

    def set_idx(self, idx):
        for l in range(len(self.legs)):
            if self.legs[l][0] == self.idx:
                self.legs[l] = (idx, self.legs[l][1])
        self.idx = idx

    def _key(self, e, eprime):

        return (
            tuple(e.astype(np.uint8).tolist()),
            tuple(eprime.astype(np.uint8).tolist()),
        )

    def is_stabilizer(self, op):
        return 0 == np.count_nonzero(op @ omega(self.n) @ self.h.T)

    def _remove_leg(self, legs, leg):
        pos = legs[leg]
        del legs[leg]
        for k in legs.keys():
            if legs[k] > pos:
                legs[k] -= 1

    def _remove_legs(self, legs, legs_to_remove):
        for leg in legs_to_remove:
            self._remove_leg(legs, leg)

    def validate_legs(self, legs):
        return [leg for leg in legs if not leg in self.legs]

    def with_coset_flipped_legs(self, coset_flipped_legs):

        return TensorStabilizerCodeEnumerator(
            self.h, self.idx, self.legs, coset_flipped_legs, self.truncate_length
        )

    def trace_with(
        self,
        other: "TensorStabilizerCodeEnumerator",
        join_legs1,
        join_legs2,
        traced_legs1,
        traced_legs2,
        e1: GF2,
        eprime1: GF2,
        e2: GF2,
        eprime2: GF2,
        open_legs1,
        open_legs2,
    ):
        """If legs are not indexed, they will be based on the first index of this component (if it is a conjoining of multiple nodes)."""

        join_legs1 = _index_legs(self.idx, join_legs1)
        join_legs2 = _index_legs(other.idx, join_legs2)
        traced_legs1 = _index_legs(self.idx, traced_legs1)
        traced_legs2 = _index_legs(other.idx, traced_legs2)
        open_legs1 = _index_legs(self.idx, open_legs1)
        open_legs2 = _index_legs(other.idx, open_legs2)

        invalid_legs = self.validate_legs(join_legs1)
        assert (
            invalid_legs == []
        ), f"invalid legs to join on for tensor {self.idx}: {invalid_legs}"
        invalid_legs = self.validate_legs(open_legs1)
        assert (
            invalid_legs == []
        ), f"invalid legs to leave open for tensor {self.idx}: {invalid_legs}"

        invalid_legs = other.validate_legs(join_legs2)
        assert (
            invalid_legs == []
        ), f"invalid legs to join on for tensor {other.idx}: {invalid_legs}"
        invalid_legs = other.validate_legs(open_legs2)
        assert (
            invalid_legs == []
        ), f"invalid legs to leave open for tensor {other.idx}: {invalid_legs}"

        assert len(join_legs1) == len(join_legs2)
        join_length = len(join_legs1)

        t1 = self.stabilizer_enumerator_polynomial(
            traced_legs1, e1, eprime1, join_legs1 + open_legs1
        )

        t2 = other.stabilizer_enumerator_polynomial(
            traced_legs2, e2, eprime2, join_legs2 + open_legs2
        )

        wep = defaultdict(lambda: SimplePoly())
        # print(f"t1: {t1}, open legs: {open_legs1}")
        # print(f"t2: {t2}, open legs: {open_legs2}")
        for k1 in t1.keys():
            for k2 in t2.keys():
                if not _equal_on_support(
                    # key indexes correspond to join_legs then open_legs
                    list(range(join_length)),
                    GF2(k1),
                    GF2(k2),
                ):
                    continue

                # print(f"match! {k1} ~ {k2}")
                wep1 = t1[k1]
                wep2 = t2[k2]
                k1_gf2 = GF2(k1)
                k2_gf2 = GF2(k2)

                # we have to cut off the join legs from both keys and concatenate them

                key = tuple(
                    sconcat(
                        sslice(k1_gf2, slice(join_length, None)),
                        sslice(k2_gf2, slice(join_length, None)),
                    ).tolist()
                )
                # print(f"key - {key} - {k1_gf2}")

                wep[key].add_inplace(wep1 * wep2)

        tracable_legs = open_legs1 + open_legs2
        # print(
        #     "tracable legs after two nodes merged: ",
        #     tracable_legs,
        #     open_legs1,
        #     open_legs2,
        # )
        # print(wep)

        return PartiallyTracedEnumerator(
            {self.idx, other.idx},
            tracable_legs=tracable_legs,
            tensor=wep,
            truncate_length=self.truncate_length,
        )

    def self_trace(self, legs1, legs2) -> "TensorStabilizerCodeEnumerator":
        assert len(legs1) == len(legs2)
        legs1 = _index_legs(self.idx, legs1)
        legs2 = _index_legs(self.idx, legs2)
        leg2col = {leg: i for i, leg in enumerate(self.legs)}
        # print(f"legs1 {legs1}")
        # print(f"legs2 {legs2}")
        # print(f"self.legs {self.legs}")

        new_h = self.h
        for leg1, leg2 in zip(legs1, legs2):
            new_h = self_trace(new_h, leg2col[leg1], leg2col[leg2])
            self._remove_legs(leg2col, [leg1, leg2])

        new_legs = [leg for leg in self.legs if leg not in legs1 and leg not in legs2]
        return TensorStabilizerCodeEnumerator(new_h, idx=self.idx, legs=new_legs)

    def conjoin(self, other, legs1, legs2) -> "TensorStabilizerCodeEnumerator":
        """Creates a new brute force tensor enumerator by conjoining two of them.

        The legs of the other will become the legs of the new one.
        """
        if self.idx == other.idx:
            return self.self_trace(legs1, legs2)
        assert len(legs1) == len(legs2)
        legs1 = _index_legs(self.idx, legs1)
        legs2 = _index_legs(other.idx, legs2)

        n2 = other.n

        leg2col = {leg: i for i, leg in enumerate(self.legs)}
        # for example 2 3 4 | 2 4 8 will become
        # as legs2_offset = 5
        # {2: 0, 3: 1, 4: 2, 7: 3, 11: 4, 13: 5}
        leg2col.update({leg: len(self.legs) + i for i, leg in enumerate(other.legs)})

        new_h = conjoin(
            self.h, other.h, self.legs.index(legs1[0]), other.legs.index(legs2[0])
        )
        self._remove_legs(leg2col, [legs1[0], legs2[0]])

        for leg1, leg2 in zip(legs1[1:], legs2[1:]):
            new_h = self_trace(new_h, leg2col[leg1], leg2col[leg2])
            self._remove_legs(leg2col, [leg1, leg2])

        new_legs = [leg for leg in self.legs if leg not in legs1]
        new_legs += [leg for leg in other.legs if leg not in legs2]

        return TensorStabilizerCodeEnumerator(
            new_h, idx=self.idx, legs=new_legs, truncate_length=self.truncate_length
        )

    def _brute_force_stabilizer_enumerator_from_parity(
        self, basis_element_legs: List[int], e=None, eprime=None, open_legs=[]
    ):
        basis_element_legs = _index_legs(self.idx, basis_element_legs)
        # print(f"passed open legs: {open_legs}")
        open_legs = _index_legs(self.idx, open_legs)
        invalid_legs = self.validate_legs(basis_element_legs)
        if len(invalid_legs) > 0:
            raise ValueError(
                f"Can't trace legs: {invalid_legs}, they don't exist on node {self.idx}"
            )
        invalid_legs = self.validate_legs(open_legs)
        if len(invalid_legs) > 0:
            raise ValueError(
                f"Can't leave legs open for tensor: {invalid_legs}, they don't exist on node {self.idx} with legs:\n{self.legs}"
            )

        traced_cols = [self.legs.index(leg) for leg in basis_element_legs]
        open_cols = [self.legs.index(leg) for leg in open_legs]

        if open_cols is None:
            open_cols = []

        is_diagonal_element = np.array_equal(e, eprime)
        if not is_diagonal_element:
            # check if EE' \prod_J I^(n-m) is a stabilizer
            # Proposition V.4 in Cao & Lackey 2023

            if not self.is_stabilizer(
                replace_with_op_on_indices(
                    traced_cols, e + eprime, GF2.Zeros(self.n * 2)
                )
            ):
                return 0

        class SimpleStabilizerCollector:
            def __init__(self, k, n, coset):
                self.k = k
                self.n = n
                self.coset = coset
                self.tensor_wep = SimplePoly()
                self.skip_indices = np.concatenate([traced_cols, open_cols])

            def collect(self, stabilizer):
                stab_weight = weight(
                    stabilizer + self.coset, skip_indices=self.skip_indices
                )
                # print(f"simple {stabilizer + self.coset} => {stab_weight}")
                self.tensor_wep.add_inplace(SimplePoly({stab_weight: 1}))

            def finalize(self):
                pass

        class TensorElementCollector:
            def __init__(self, k, n, coset):
                self.k = k
                self.n = n
                self.coset = coset
                self.simple = len(open_cols) == 0
                self.skip_indices = np.concatenate([traced_cols, open_cols])

                self.matching_stabilizers = []
                self.tensor_wep = defaultdict(lambda: SimplePoly())

            def collect(self, stabilizer):
                self.matching_stabilizers.append(stabilizer)

            def _scale_one(self, wep):
                return wep

            def finalize(self):
                if not is_diagonal_element:
                    raise ValueError(
                        "TODO: non-diagonal elements are not fully supported yet."
                    )
                for s in self.matching_stabilizers:
                    stab_weight = weight(s + self.coset, skip_indices=self.skip_indices)
                    # print(f"tensor {s + self.coset} => {stab_weight}")
                    key = tuple(sslice(s, open_cols).tolist())
                    self.tensor_wep[key].add_inplace(SimplePoly({stab_weight: 1}))

                for key in self.tensor_wep.keys():
                    self.tensor_wep[key] = self._scale_one(self.tensor_wep[key])

        coset = GF2.Zeros(2 * self.n)
        if self.coset_flipped_legs is not None:
            for leg, pauli in self.coset_flipped_legs:
                assert leg in self.legs, f"Leg in coset not found: {leg}"
                assert len(pauli) == 2 and isinstance(
                    pauli, GF2
                ), f"Invalid pauli in coset: {pauli} on leg {leg}"
                coset[self.legs.index(leg)] = pauli[0]
                coset[self.legs.index(leg) + self.n] = pauli[1]
                # print(
                #     f"brute force - node {self.idx} leg: {leg} index: {self.legs.index(leg)} - {pauli}"
                # )
        collector = (
            SimpleStabilizerCollector(self.k, self.n, coset)
            if open_cols == []
            else TensorElementCollector(self.k, self.n, coset)
        )

        h_reduced = gauss(self.h)
        h_reduced = h_reduced[~np.all(h_reduced == 0, axis=1)]

        for i in range(2 ** len(h_reduced)):
            picked_generators = GF2(
                list(np.binary_repr(i, width=(self.n - self.k))), dtype=int
            )
            if len(h_reduced) == 0:
                if i > 0:
                    continue
                else:
                    stabilizer = GF2.Zeros(self.n * 2)
            else:
                stabilizer = picked_generators @ h_reduced

            if is_diagonal_element and not _suboperator_matches_on_support(
                traced_cols, stabilizer, e
            ):
                # we are only interested in stabilizers that have the diagonal element on indices
                continue
            elif not is_diagonal_element:
                # we want to count stabilizers that one of the off-diagonal components
                # a non-zero count would mean that there is a stabilizer for both
                matching_off_diagonals = (
                    _suboperator_matches_on_support(traced_cols, stabilizer, e)
                    and self.is_stabilizer(
                        replace_with_op_on_indices(traced_cols, eprime, stabilizer)
                    )
                ) or (
                    _suboperator_matches_on_support(traced_cols, stabilizer, eprime)
                    and self.is_stabilizer(
                        replace_with_op_on_indices(traced_cols, e, stabilizer)
                    )
                )
                if not matching_off_diagonals:
                    continue
            collector.collect(stabilizer)
        collector.finalize()
        return collector.tensor_wep

    def stabilizer_enumerator_polynomial(
        self,
        basis_element_legs: List[int] = [],
        e: GF2 = None,
        eprime: GF2 = None,
        open_legs=[],
    ) -> SimplePoly:
        """Stabilizer enumerator polynomial.

        If open_legs left empty, it gives the scalar stabilizer enumerator polynomial.
        If basis_element_legs is not empty, the enumerators will be for elements that exactly match E and E' (represented by e, eprime)
        on basis_element_legs.
        If open_legs is not empty, then the result is a sparse tensor, with non-zero values on the open_legs.
        """
        m = len(basis_element_legs)
        if e is None:
            e = GF2.Zeros(2 * m)
        if eprime is None:
            eprime = e.copy()
        assert len(e) == m * 2, f"{len(e)} != {m*2}"
        assert len(eprime) == m * 2, f"{len(eprime)} != {m*2}"

        wep = self._brute_force_stabilizer_enumerator_from_parity(
            basis_element_legs, e, eprime, open_legs=open_legs
        )
        return wep

    def stabilizer_enumerator(
        self,
        traced_legs: List[int] = [],
        e: GF2 = None,
        eprime: GF2 = None,
        open_legs=[],
    ):
        if open_legs is not None and len(open_legs) > 0:
            raise ValueError("only polynomials are allowed with open legs.")
        unnormalized_poly = self.stabilizer_enumerator_polynomial(
            traced_legs,
            e,
            eprime,
            open_legs=open_legs,
        )

        return unnormalized_poly._dict

    def trace_with_stopper(self, stopper: GF2, traced_leg: Union[int, Tuple[int, int]]):

        return self.conjoin(
            TensorStabilizerCodeEnumerator(GF2([stopper]), idx="stopper"),
            [traced_leg],
            [0],
        )
