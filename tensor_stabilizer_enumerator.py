from collections import defaultdict
from copy import deepcopy
import dataclasses
import time
from typing import Any, Iterable, List, Dict, Set, Tuple, Union
from galois import GF2
import numpy as np
import sympy
from tqdm import tqdm

from legos import Legos
from linalg import gauss
from parity_check import conjoin, self_trace, sprint
from scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from simple_poly import SimplePoly
from symplectic import omega, weight

from sympy.abc import w, z

from tensor_legs import TensorLegs

PAULI_I = GF2([0, 0])
PAULI_X = GF2([1, 0])
PAULI_Z = GF2([0, 1])
PAULI_Y = GF2([1, 1])


def _paulis(n):
    """Yields the length 2*n GF2 symplectic Pauli operators on n qubits."""
    for i in range(2 ** (2 * n)):
        yield GF2(list(np.binary_repr(i, width=2 * n)))


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
    ):
        if isinstance(nodes, dict):
            for k, v in nodes.items():
                if k != v.idx:
                    raise ValueError(
                        f"Nodes dict passed in with inconsitent indexing, {k} != {v.idx} for {v}."
                    )
            self.nodes: Dict["TensorStabilizerCodeEnumerator"] = nodes
        else:
            nodes_dict = {node.idx: node for node in nodes}
            if len(nodes_dict) < len(nodes):
                raise ValueError(f"There are colliding index values of nodes: {nodes}")
            self.nodes = nodes_dict

        self.traces = []
        self.legs_left_to_join = {idx: [] for idx in self.nodes.keys()}
        # self.open_legs = [n.legs for n in self.nodes]

        self._wep = None
        self.ptes: Dict[int, PartiallyTracedEnumerator] = {}

    @classmethod
    def make_rsc(cls, d: int, lego=lambda i: Legos.econding_tensor_512):

        nodes = [TensorStabilizerCodeEnumerator(lego(i), idx=i) for i in range(d**2)]

        # row major ordering
        idx = lambda r, c: r * d + c

        for c in range(d):
            # top Z boundary
            nodes[idx(0, c)] = nodes[idx(0, c)].trace_with_stopper(
                PAULI_Z, 3 if c % 2 == 0 else 0
            )
            # bottom Z boundary
            nodes[idx(d - 1, c)] = nodes[idx(d - 1, c)].trace_with_stopper(
                PAULI_Z, 1 if c % 2 == 0 else 2
            )

        for r in range(d):
            # left X boundary
            nodes[idx(r, 0)] = nodes[idx(r, 0)].trace_with_stopper(
                PAULI_X, 0 if r % 2 == 0 else 1
            )
            # right X boundary
            nodes[idx(r, d - 1)] = nodes[idx(r, d - 1)].trace_with_stopper(
                PAULI_X, 2 if r % 2 == 0 else 3
            )

        # for r in range(1,4):
        #     # bulk
        #     for c in range(1,4):

        tn = TensorNetwork(nodes)

        for radius in range(1, d):
            for i in range(radius + 1):
                # extending the right boundary
                tn.self_trace(
                    idx(i, radius - 1),
                    idx(i, radius),
                    [3 if idx(i, radius) % 2 == 0 else 2],
                    [0 if idx(i, radius) % 2 == 0 else 1],
                )
                if i > 0 and i < radius:
                    tn.self_trace(
                        idx(i - 1, radius),
                        idx(i, radius),
                        [2 if idx(i, radius) % 2 == 0 else 1],
                        [3 if idx(i, radius) % 2 == 0 else 0],
                    )
                # extending the bottom boundary
                tn.self_trace(
                    idx(radius - 1, i),
                    idx(radius, i),
                    [2 if idx(i, radius) % 2 == 0 else 1],
                    [3 if idx(i, radius) % 2 == 0 else 0],
                )
                if i > 0 and i < radius:
                    tn.self_trace(
                        idx(radius, i - 1),
                        idx(radius, i),
                        [3 if idx(i, radius) % 2 == 0 else 2],
                        [0 if idx(i, radius) % 2 == 0 else 1],
                    )
        return tn

    @classmethod
    def make_surface_code(clz, d: int, lego=lambda i: Legos.econding_tensor_512):

        if d < 2:
            raise ValueError("Only d=2+ is supported.")

        # numbering convention:

        # (0,0)  (0,2)  (0,4)
        #    (1,1)   (1,3)
        # (2,0)  (2,2)  (2,4)
        #    (3,1)   (3,3)
        # (4,0)  (4,2)  (4,4)

        last_row = 2 * d - 2
        last_col = 2 * d - 2

        tn = TensorNetwork(
            [
                TensorStabilizerCodeEnumerator(lego((r, c)), idx=(r, c))
                for r in range(last_row + 1)
                for c in range(r % 2, last_col + 1, 2)
            ]
        )

        nodes = tn.nodes

        # we take care of corners first

        nodes[(0, 0)] = (
            nodes[(0, 0)]
            .trace_with_stopper(PAULI_Z, 0)
            .trace_with_stopper(PAULI_Z, 1)
            .trace_with_stopper(PAULI_X, 3)
        )
        nodes[(0, last_col)] = (
            nodes[(0, last_col)]
            .trace_with_stopper(PAULI_Z, 2)
            .trace_with_stopper(PAULI_Z, 3)
            .trace_with_stopper(PAULI_X, 0)
        )
        nodes[(last_row, 0)] = (
            nodes[(last_row, 0)]
            .trace_with_stopper(PAULI_Z, 0)
            .trace_with_stopper(PAULI_Z, 1)
            .trace_with_stopper(PAULI_X, 2)
        )
        nodes[(last_row, last_col)] = (
            nodes[(last_row, last_col)]
            .trace_with_stopper(PAULI_Z, 2)
            .trace_with_stopper(PAULI_Z, 3)
            .trace_with_stopper(PAULI_X, 1)
        )

        for k in range(2, last_col, 2):
            # X boundaries on the top and bottom
            nodes[(0, k)] = (
                nodes[(0, k)]
                .trace_with_stopper(PAULI_X, 0)
                .trace_with_stopper(PAULI_X, 3)
            )
            nodes[(last_row, k)] = (
                nodes[(last_row, k)]
                .trace_with_stopper(PAULI_X, 1)
                .trace_with_stopper(PAULI_X, 2)
            )

            # Z boundaries on left and right
            nodes[(k, 0)] = (
                nodes[(k, 0)]
                .trace_with_stopper(PAULI_Z, 0)
                .trace_with_stopper(PAULI_Z, 1)
            )
            nodes[(k, last_col)] = (
                nodes[(k, last_col)]
                .trace_with_stopper(PAULI_Z, 2)
                .trace_with_stopper(PAULI_Z, 3)
            )

        # we'll trace diagonally
        for diag in range(1, last_row + 1):
            # connecting the middle to the previous diagonal's middle
            tn.self_trace(
                (diag - 1, diag - 1),
                (diag, diag),
                [2 if diag % 2 == 1 else 1],
                [3 if diag % 2 == 1 else 0],
            )
            # go left until hitting the left column or the bottom row
            # and at the same time go right until hitting the right col or the top row (symmetric)
            row, col = diag + 1, diag - 1
            while row <= last_row and col >= 0:
                # going left
                tn.self_trace(
                    (row - 1, col + 1),
                    (row, col),
                    [0 if row % 2 == 0 else 1],
                    [3 if row % 2 == 0 else 2],
                )

                # going right
                tn.self_trace(
                    (col + 1, row - 1),
                    (col, row),
                    [3 if row % 2 == 1 else 2],
                    [0 if row % 2 == 1 else 1],
                )

                if row - 1 >= 0 and col - 1 >= 0:
                    # connect to previous diagonal
                    # on the left
                    tn.self_trace(
                        (row - 1, col - 1),
                        (row, col),
                        [2 if row % 2 == 1 else 1],
                        [3 if row % 2 == 1 else 0],
                    )
                    # on the right
                    tn.self_trace(
                        (col - 1, row - 1),
                        (col, row),
                        [2 if row % 2 == 1 else 1],
                        [3 if row % 2 == 1 else 0],
                    )

                row += 1
                col -= 1
            # go right until hitting the right column

        return tn

    @classmethod
    def make_compass_sq(clz, coloring):
        d = len(coloring) + 1
        tn = clz.make_surface_code(d)
        gauge_idxs = [
            (r, c) for r in range(1, 2 * d - 1, 2) for c in range(1, 2 * d - 1, 2)
        ]
        for n, color in zip(gauge_idxs, np.reshape(coloring, (d - 1) ** 2)):
            tn.nodes[n] = tn.nodes[n].trace_with_stopper(
                PAULI_Z if color == 2 else PAULI_X, 4
            )
        return tn

    @classmethod
    def from_css_parity_check_matrix(clz, hx, hz):
        rx, n = hx.shape
        rz = hz.shape[0]

        q_tensors = []

        for q in range(n):
            x_stabs = np.nonzero(hx[:, q])[0]
            n_x_legs = len(x_stabs)
            z_stabs = np.nonzero(hz[:, q])[0]
            n_z_legs = len(z_stabs)
            # print(q, x_stabs, z_stabs)
            h0 = TensorStabilizerCodeEnumerator(Legos.h, idx=f"q{q}.h0")
            h1 = TensorStabilizerCodeEnumerator(Legos.h, idx=f"q{q}.h1")

            x = TensorStabilizerCodeEnumerator(
                Legos.x_rep_code(2 + n_x_legs), idx=f"q{q}.x"
            )
            z = TensorStabilizerCodeEnumerator(
                Legos.x_rep_code(2 + n_z_legs), idx=f"q{q}.z"
            )
            # leg numbering for the spiders: 0 for logical, 1 for physical,
            # rest is to the check nodes
            q_tensor = (
                h0.conjoin(z, [1], [0])
                .conjoin(h1, [(f"q{q}.z", 1)], [0])
                .conjoin(x, [(f"q{q}.h1", 1)], [0])
            )

            q_tensor.set_idx(f"q{q}")
            q_tensor = q_tensor.trace_with_stopper(PAULI_I, (f"q{q}", 0))
            q_tensors.append(q_tensor)
            # print(q_tensor.legs)
        traces = []

        q_legs = [2] * n
        gx_tensors = []
        for i, gx in enumerate(hx):
            qs = np.nonzero(gx)[0]
            g_tensor = TensorStabilizerCodeEnumerator(
                Legos.z_rep_code(len(qs)), f"x{i}"
            )
            # print(f"=== x tensor {g_tensor.idx} -> {qs} === ")

            gx_tensors.append(g_tensor)
            for g_leg, q in enumerate(qs):
                traces.append(
                    (
                        g_tensor.idx,
                        q_tensors[q].idx,
                        [g_leg],
                        [(f"q{q}.x", q_legs[q])],
                    )
                )
                q_legs[q] += 1
        gz_tensors = []
        q_legs = [2] * n

        for i, gz in enumerate(hz):
            qs = np.nonzero(gz)[0]
            g_tensor = TensorStabilizerCodeEnumerator(
                Legos.z_rep_code(len(qs)), f"z{i}"
            )
            gz_tensors.append(g_tensor)
            for g_leg, q in enumerate(qs):
                traces.append(
                    (
                        g_tensor.idx,
                        q_tensors[q].idx,
                        [g_leg],
                        [(f"q{q}.z", q_legs[q])],
                    )
                )
                q_legs[q] += 1
        tn = TensorNetwork(q_tensors + gx_tensors + gz_tensors)

        for t in traces:
            tn.self_trace(*t)
        return tn

    def self_trace(self, node_idx1, node_idx2, join_legs1, join_legs2):
        if self._wep is not None:
            raise ValueError(
                "Tensor network weight enumerator is already traced no new tracing schedule is allowed."
            )
        join_legs1 = self.nodes[node_idx1]._index_legs(node_idx1, join_legs1)
        join_legs2 = self.nodes[node_idx2]._index_legs(node_idx2, join_legs2)

        # print(f"adding trace {node_idx1, node_idx2, join_legs1, join_legs2}")
        self.traces.append((node_idx1, node_idx2, join_legs1, join_legs2))

        self.legs_left_to_join[node_idx1] += join_legs1
        self.legs_left_to_join[node_idx2] += join_legs2

    def traces_to_dot(self):
        print("-----")
        # print(self.open_legs)
        # for n, legs in enumerate(self.open_legs):
        #     for leg in legs:
        #         print(f"n{n} -> n{n}_{leg}")

        for node_idx1, node_idx2, join_legs1, join_legs2 in self.traces:
            for leg1, leg2 in zip(join_legs1, join_legs2):
                print(f"n{node_idx1} -> n{node_idx2} ")

    def analyze_traces(self):
        new_tn = TensorNetwork(deepcopy(self.nodes))
        new_tn.traces = deepcopy(self.traces)
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
        print(f"    pte nodes: {pte_nodes}")
        print(
            f"    Total legs to trace: {sum(len(legs) for legs in new_tn.legs_left_to_join)}"
        )
        for node_idx1, node_idx2, join_legs1, join_legs2 in new_tn.traces:
            print(f"==== trace { node_idx1, node_idx2, join_legs1, join_legs2} ==== ")

            for leg in join_legs1:
                new_tn.legs_left_to_join[node_idx1].remove(leg)
            for leg in join_legs2:
                new_tn.legs_left_to_join[node_idx2].remove(leg)

            if node_idx1 not in pte_nodes and node_idx2 not in pte_nodes:
                next_pte = 0 if len(pte_nodes) == 0 else max(pte_nodes.values()) + 1
                pte_nodes[node_idx1] = next_pte
                pte_nodes[node_idx2] = next_pte
            elif node_idx1 in pte_nodes and node_idx2 not in pte_nodes:
                pte_nodes[node_idx2] = pte_nodes[node_idx1]
            elif node_idx2 in pte_nodes and node_idx1 not in pte_nodes:
                pte_nodes[node_idx1] = pte_nodes[node_idx2]
            elif pte_nodes[node_idx1] == pte_nodes[node_idx2]:
                print(f"self trace in PTE {pte_nodes[node_idx1]}")
            else:
                print("MERGE")
                for node in pte_nodes.keys():
                    if pte_nodes[node] == pte_nodes[node_idx2]:
                        pte_nodes[node] = pte_nodes[node_idx1]

            print(f"    pte nodes: {pte_nodes}")
            print(
                f"    Total legs to trace: {sum(len(legs) for legs in new_tn.legs_left_to_join.values())}"
            )
            num_pte_legs = sum(
                len(new_tn.legs_left_to_join[node]) for node in pte_nodes.keys()
            )
            max_pte_legs = max(max_pte_legs, num_pte_legs)
            print(f"    PTE legs: {num_pte_legs}")

        print("=== Final state ==== ")
        print(
            f"pte nodes: {pte_nodes} is all nodes {set(pte_nodes.keys()) == set(new_tn.nodes.keys())} "
        )
        print(
            f"Total legs to trace: {sum(len(legs) for legs in new_tn.legs_left_to_join.values())}: { new_tn.legs_left_to_join}"
        )
        print(
            f"PTE legs: {sum(len(new_tn.legs_left_to_join[node]) for node in pte_nodes.keys())}"
        )
        print(
            f"PTE legs: {[new_tn.legs_left_to_join[node] for node in pte_nodes.keys()]}"
        )
        print(f"Maximum PTE legs: {max_pte_legs}")

    def conjoin_nodes(self, verbose: bool = False, progress_bar: bool = False):
        pte_nodes = []

        pte: TensorStabilizerCodeEnumerator = None
        prog = lambda x: x if not progress_bar else tqdm(x, leave=False)
        for node_idx1, node_idx2, join_legs1, join_legs2 in prog(self.traces):
            if verbose:
                print(
                    f"==== trace { node_idx1, node_idx2, join_legs1, join_legs2} ==== "
                )

            join_legs1 = self.nodes[node_idx1]._index_legs(node_idx1, join_legs1)
            join_legs2 = self.nodes[node_idx2]._index_legs(node_idx2, join_legs2)

            if pte_nodes == []:
                pte_nodes.append(node_idx1)
                pte_nodes.append(node_idx2)
                pte = self.nodes[node_idx1].conjoin(
                    self.nodes[node_idx2], legs1=join_legs1, legs2=join_legs2
                )
            elif node_idx1 in pte_nodes and node_idx2 not in pte_nodes:
                if verbose:
                    print(f"adding {node_idx2} to PTE (contains {node_idx1})")
                pte_nodes.append(node_idx2)
                pte = pte.conjoin(
                    self.nodes[node_idx2], legs1=join_legs1, legs2=join_legs2
                )
            elif node_idx1 not in pte_nodes and node_idx2 in pte_nodes:
                if verbose:
                    print(f"adding {node_idx1} to PTE (contains {node_idx2})")
                pte_nodes.append(node_idx1)
                pte = pte.conjoin(
                    self.nodes[node_idx1], legs1=join_legs2, legs2=join_legs1
                )
            elif node_idx1 in pte_nodes and node_idx2 in pte_nodes:
                if verbose:
                    print(
                        f"self trace on PTE in which both {node_idx1, node_idx2} are contained"
                    )
                pte = pte.self_trace(join_legs1, join_legs2)
            else:
                raise ValueError(
                    f"independent components are not yet supported by conjoin_nodes. PTE nodes: {pte_nodes}, new nodes: {node_idx1}, {node_idx2}"
                )
            if verbose:
                print("H:")
                sprint(pte.h)
        return pte

    def stabilizer_enumerator_polynomial(
        self,
        legs: List[Tuple[int, int]] = [],
        e: GF2 = None,
        eprime: GF2 = None,
        verbose: bool = False,
        progress_bar: bool = False,
        summed_legs: List[Tuple[int, int]] = [],
    ) -> SimplePoly:
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
        if len(self.traces) == 0:
            raise ValueError(
                "Completely disconnected nodes is unsupported. TODO: implement tensoring of disconnected component weight enumerators."
            )

        prog = lambda x: x if not progress_bar else tqdm(x, leave=False)
        for node_idx1, node_idx2, join_legs1, join_legs2 in prog(self.traces):
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

                # print(f"joining two nodes with open legs: {open_legs1}, {open_legs2}")

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
                    print(f"MERGING to components {node1_pte} and {node2_pte}")
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
            # print("PTE tensor: ")
            # for k, v in node1_pte.tensor.items():
            #     print(k, v)
            # print(f"PTEs: {self.ptes}")

        # TODO: this is valid for the reduced WEP only - but it's okay as we'll switch over to reduced WEP shortly
        self._wep = SimplePoly()
        for k, sub_wep in pte.tensor.items():
            self._wep.add_inplace(sub_wep * SimplePoly({weight(GF2(k[0])): 1}))
        # self._wep = node1_pte.tensor[((), ())]
        return self._wep

    def stabilizer_enumerator(
        self, k, legs: List[Tuple[int, List[int]]], e: GF2 = None, eprime: GF2 = None
    ):
        wep = self.stabilizer_enumerator_polynomial(legs, e, eprime)
        if wep == 0:
            return {}
        unnormalized_poly = wep
        return unnormalized_poly._dict


class PartiallyTracedEnumerator:
    def __init__(
        self, nodes: Set[int], tracable_legs: List[Tuple[int, int]], tensor: np.ndarray
    ):
        self.nodes = nodes
        self.tracable_legs = tracable_legs
        self.tensor = tensor

        tensor_key_length = len(list(self.tensor.keys())[0][0])
        assert tensor_key_length == 2 * len(
            tracable_legs
        ), f"tensor keys of length {tensor_key_length} != {2 * len(tracable_legs)} (2 * len tracable legs)"

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

        prog = lambda x: x if not progress_bar else tqdm(x, leave=False)
        for k1 in prog(self.tensor.keys()):
            k1_gf2 = GF2(k1[0]), GF2(k1[1])
            for k2 in prog(pte2.tensor.keys()):
                k2_gf2 = GF2(k2[0]), GF2(k2[1])
                if not np.array_equal(
                    sslice(k1_gf2[0], join_indices1),
                    sslice(k2_gf2[0], join_indices2),
                ) or not np.array_equal(
                    sslice(k1_gf2[1], join_indices1),
                    sslice(k2_gf2[1], join_indices2),
                ):
                    continue

                wep1 = self.tensor[k1]
                wep2 = pte2.tensor[k2]

                # we have to cut off the join legs from both keys and concatenate them
                key = (
                    # e
                    tuple(
                        sconcat(
                            sslice(k1_gf2[0], kept_indices1),
                            sslice(k2_gf2[0], kept_indices2),
                        ).tolist()
                    ),
                    # eprime
                    tuple(
                        sconcat(
                            sslice(k1_gf2[1], kept_indices1),
                            sslice(k2_gf2[1], kept_indices2),
                        ).tolist()
                    ),
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
            self.nodes, tracable_legs=tracable_legs, tensor=wep
        )

    def self_trace(self, join_legs1, join_legs2, progress_bar: bool = False):
        assert len(join_legs1) == len(join_legs2)
        join_length = len(join_legs1)

        wep = defaultdict(lambda: SimplePoly())
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

        prog = lambda x: x if not progress_bar else tqdm(x, leave=False)
        for old_key in prog(self.tensor.keys()):
            if not np.array_equal(
                sslice(GF2(old_key[0]), join_indices1),
                sslice(GF2(old_key[0]), join_indices2),
            ) or not np.array_equal(
                sslice(GF2(old_key[1]), join_indices1),
                sslice(GF2(old_key[1]), join_indices2),
            ):
                continue

            wep1 = self.tensor[old_key]

            k1_gf2 = GF2(old_key[0]), GF2(old_key[1])

            # we have to cut off the join legs from both keys and concatenate them

            key = (
                # e
                tuple(sslice(k1_gf2[0], kept_indices).tolist()),
                # eprime
                tuple(sslice(k1_gf2[1], kept_indices).tolist()),
            )

            assert len(key[0]) == 2 * (
                len(open_legs)
            ), f"key length: {len(key[0])} != 2*{len(open_legs)} = {2 * len(open_legs)}"
            # print(f"key: {key}")
            # print(f"wep: {wep1}")

            wep[key].add_inplace(wep1)

        tracable_legs = [(idx, leg) for idx, leg in open_legs]

        return PartiallyTracedEnumerator(
            self.nodes, tracable_legs=tracable_legs, tensor=wep
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

        wep = defaultdict(lambda: SimplePoly())

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

        prog = lambda x: x if not progress_bar else tqdm(x, leave=False)

        for k1 in prog(self.tensor.keys()):
            k1_gf2 = GF2(k1[0]), GF2(k1[1])
            for k2 in prog(t2.keys()):
                k2_gf2 = GF2(k2[0]), GF2(k2[1])
                if not np.array_equal(
                    sslice(k1_gf2[0], join_indices1),
                    sslice(k2_gf2[0], join_indices2),
                ) or not np.array_equal(
                    sslice(k1_gf2[1], join_indices1),
                    sslice(k2_gf2[1], join_indices2),
                ):
                    continue

                wep1 = self.tensor[k1]
                wep2 = t2[k2]

                # we have to cut off the join legs from both keys and concatenate them
                key = (
                    # e
                    tuple(
                        sconcat(
                            sslice(k1_gf2[0], kept_indices1),
                            sslice(k2_gf2[0], kept_indices2),
                        ).tolist()
                    ),
                    # eprime
                    tuple(
                        sconcat(
                            sslice(k1_gf2[1], kept_indices1),
                            sslice(k2_gf2[1], kept_indices2),
                        ).tolist()
                    ),
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
            self.nodes.union({other.idx}), tracable_legs=tracable_legs, tensor=wep
        )


class TensorStabilizerCodeEnumerator:
    """The tensor enumerator from Cao & Lackey"""

    def __init__(self, h, idx=0, legs=None):
        self.h = h

        self.idx = idx
        if len(self.h) == 0:
            self.n = 0
            self.k = 0
        elif len(self.h.shape) == 1:
            self.n = self.h.shape[0] // 2
            self.k = self.n - 1
        else:
            self.n = self.h.shape[1] // 2
            self.k = self.n - self.h.shape[0]

        self.legs = [(self.idx, leg) for leg in range(self.n)] if legs is None else legs
        assert (
            len(self.legs) == self.n
        ), f"Leg number {len(self.legs)} does not match parity check matrix columns (qubit count) {self.n}"
        # a dict is a wonky tensor - TODO: rephrase this to proper tensor
        self._stabilizer_enums: Dict[sympy.Tuple, SimplePoly] = {}

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

    def _index_legs(self, idx, legs):
        if legs is not None:
            return [(idx, leg) if isinstance(leg, int) else leg for leg in legs]
        return legs

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

        join_legs1 = self._index_legs(self.idx, join_legs1)
        join_legs2 = self._index_legs(other.idx, join_legs2)
        traced_legs1 = self._index_legs(self.idx, traced_legs1)
        traced_legs2 = self._index_legs(other.idx, traced_legs2)
        open_legs1 = self._index_legs(self.idx, open_legs1)
        open_legs2 = self._index_legs(other.idx, open_legs2)

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

        open_length = len(join_legs1 + open_legs1) + len(join_legs2 + open_legs2)

        wep = defaultdict(lambda: SimplePoly())

        for k1 in t1.keys():
            for k2 in t2.keys():
                if not _equal_on_support(
                    list(range(join_length)),
                    GF2(k1[0]),
                    GF2(k2[0]),
                ) or not _equal_on_support(
                    list(range(join_length)),
                    GF2(k1[1]),
                    GF2(k2[1]),
                ):
                    continue

                wep1 = t1[k1]
                wep2 = t2[k2]
                k1_gf2 = GF2(k1[0]), GF2(k1[1])
                k2_gf2 = GF2(k2[0]), GF2(k2[1])

                # we have to cut off the join legs from both keys and concatenate them

                key = (
                    # e
                    tuple(
                        sconcat(
                            sslice(k1_gf2[0], slice(join_length, None)),
                            sslice(k2_gf2[0], slice(join_length, None)),
                        ).tolist()
                    ),
                    # eprime
                    tuple(
                        sconcat(
                            sslice(k1_gf2[1], slice(join_length, None)),
                            sslice(k2_gf2[1], slice(join_length, None)),
                        ).tolist()
                    ),
                )

                wep[key].add_inplace(wep1 * wep2)

        tracable_legs = open_legs1 + open_legs2
        # print(
        #     "tracable legs after two nodes merged: ",
        #     tracable_legs,
        #     open_legs1,
        #     open_legs2,
        # )

        return PartiallyTracedEnumerator(
            {self.idx, other.idx}, tracable_legs=tracable_legs, tensor=wep
        )

    def self_trace(self, legs1, legs2) -> "TensorStabilizerCodeEnumerator":
        assert len(legs1) == len(legs2)
        legs1 = self._index_legs(self.idx, legs1)
        legs2 = self._index_legs(self.idx, legs2)
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
        assert (
            self.idx != other.idx
        ), f"Both stabilizer nodes have {self.idx} index - can't conjoin them."
        assert len(legs1) == len(legs2)
        legs1 = self._index_legs(self.idx, legs1)
        legs2 = self._index_legs(other.idx, legs2)

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

        return TensorStabilizerCodeEnumerator(new_h, idx=self.idx, legs=new_legs)

    def _brute_force_stabilizer_enumerator_from_parity(
        self, basis_element_legs: List[int], e=None, eprime=None, open_legs=[]
    ):
        basis_element_legs = self._index_legs(self.idx, basis_element_legs)
        # print(f"passed open legs: {open_legs}")
        open_legs = self._index_legs(self.idx, open_legs)
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
            def __init__(self, k, n):
                self.k = k
                self.n = n
                self.wep = SimplePoly()
                self.skip_indices = np.concatenate([traced_cols, open_cols])

            def collect(self, stabilizer):
                stab_weight = weight(stabilizer, skip_indices=self.skip_indices)
                self.wep.add_inplace(SimplePoly({stab_weight: 1}))

            def finalize(self):
                self.wep = self.wep

        class DoubleStabilizerCollector:
            def __init__(self, k, n):
                self.k = k
                self.n = n
                self.simple = len(open_cols) == 0
                self.skip_indices = np.concatenate([traced_cols, open_cols])

                self.matching_stabilizers = []
                self.wep = defaultdict(lambda: SimplePoly())

            def collect(self, stabilizer):
                self.matching_stabilizers.append(stabilizer)

            def _scale_one(self, wep):
                return wep

            def finalize(self):
                # print("finalizing...")
                # complement indices for traced cols
                # tlc = [leg for leg in range(self.n) if leg not in traced_cols]
                # complement indices for open cols
                # olc = [leg for leg in range(self.n) if leg not in open_cols]

                # we are counting the number of stabilizers that are already matching
                # on the traced legs with E, E' - either they are diagonal or offdiagonal
                # if we are in diagonal land, then it is enough to just simply count them up with the right keys
                if not is_diagonal_element:
                    raise ValueError(
                        "TODO: non-diagonal elements are not fully supported yet."
                    )
                for s1 in self.matching_stabilizers:
                    stab_weight = weight(s1, skip_indices=self.skip_indices)
                    # for s2 in self.matching_stabilizers:

                    #     if not _suboperator_matches_on_support(
                    #         olc, s1, sslice(s2, olc)
                    #     ):
                    #         continue
                    key1 = tuple(sslice(s1, open_cols).tolist())
                    self.wep[
                        (
                            key1,
                            key1,
                        )
                    ].add_inplace(SimplePoly({stab_weight: 1}))

                for key in self.wep.keys():
                    self.wep[key] = self._scale_one(self.wep[key])

        collector = (
            SimpleStabilizerCollector(self.k, self.n)
            if open_cols == []
            else DoubleStabilizerCollector(self.k, self.n)
        )
        # assuming a full rank parity check
        for i in range(2 ** (self.n - self.k)):
            picked_generators = GF2(
                list(np.binary_repr(i, width=(self.n - self.k))), dtype=int
            )
            stabilizer = picked_generators @ self.h

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
        return collector.wep

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
        if isinstance(traced_leg, int):
            traced_leg = (self.idx, traced_leg)
        if traced_leg not in self.legs:
            raise ValueError(f"can't trace on {traced_leg} - no such leg.")
        # other = TensorStabilizerCodeEnumerator(stopper, legs=[0])
        # return self.conjoin(other, [traced_leg], [0])
        kept_cols = list(range(2 * self.n))
        kept_cols.remove(self.legs.index(traced_leg))
        kept_cols.remove(self.legs.index(traced_leg) + self.n)
        # print(
        #     f"to remove: {self.legs.index(traced_leg)}, {self.legs.index(traced_leg)+self.n}"
        # )
        kept_cols = np.array(kept_cols)
        # print(f"kept cols {kept_cols}")
        h_new = gauss(
            self.h,
            col_subset=[
                self.legs.index(traced_leg),
                self.legs.index(traced_leg) + self.n,
            ],
        )

        # print(f"h_new {traced_leg}")
        # print(h_new)
        # print(h_new[:, kept_cols])
        # for row in h_new:
        #     print(
        #         row[kept_cols],
        #         _suboperator_matches_on_support(
        #             [self.legs.index(traced_leg)], row, stopper
        #         )
        #         or _suboperator_matches_on_support(
        #             [self.legs.index(traced_leg)], row, GF2([0, 0])
        #         ),
        #     )

        h_new = GF2(
            [
                row[kept_cols]
                for row in h_new
                if _suboperator_matches_on_support(
                    [self.legs.index(traced_leg)], row, stopper
                )
                or _suboperator_matches_on_support(
                    [self.legs.index(traced_leg)], row, GF2([0, 0])
                )
            ]
        )
        kept_legs = self.legs.copy()
        kept_legs.remove(traced_leg)

        # print(f"h_new {traced_leg}")
        # print(h_new)

        return TensorStabilizerCodeEnumerator(h=h_new, idx=self.idx, legs=kept_legs)
