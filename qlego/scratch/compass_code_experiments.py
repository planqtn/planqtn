import json
import sys
import time
from galois import GF2
from matplotlib import pyplot as plt
import numpy as np

from qlego.codes.compass_code import CompassCodeTN
from qlego.linalg import gauss
from qlego.parity_check import sprint
from qlego.legos import Legos
from qlego.progress_reporter import TqdmProgressReporter
from qlego.tensor_network import (
    PAULI_I,
    PAULI_X,
    PAULI_Z,
    TensorNetwork,
    StabilizerCodeTensorEnumerator,
    sconcat,
)

import cotengra as ctg
from sympy.abc import w, z


def compass_code_from_surface_code_via_gauge_fixing():
    # tn = TensorNetwork.make_surface_code(
    #     3,
    #     lambda idx: (
    #         Legos.econding_tensor_512 if idx[0] % 2 == 0 else Legos.stab_code_parity_422
    #     ),
    # )

    d = 3

    tn = TensorNetwork.make_surface_code(
        d,
        lambda idx: (Legos.enconding_tensor_512),
    )

    coloring = np.array(
        [
            [1, 1],
            [2, 1],
        ]
    )

    # coloring = np.random.randint(1, 2, (6, 6))

    gauge_idxs = [
        (r, c) for r in range(1, 2 * d - 1, 2) for c in range(1, 2 * d - 1, 2)
    ]
    for n, color in zip(gauge_idxs, coloring.reshape(coloring.size)):
        tn.nodes[n] = tn.nodes[n].trace_with_stopper(
            PAULI_Z if color == 2 else PAULI_X, 4
        )

    tn.traces = cotengra_fun(tn)
    tn.analyze_traces()

    print(
        "WEP from compass TN:",
        tn.stabilizer_enumerator_polynomial(progress_reporter=TqdmProgressReporter()),
    )

    # conjoined = tn.conjoin_nodes()
    # # for leg in [(idx, 4) for idx in tn.nodes.keys() if idx[0] % 2 == 1]:
    # #     conjoined = conjoined.trace_with_stopper(PAULI_Z, leg)

    # np.set_printoptions(threshold=sys.maxsize, linewidth=800)

    # s = gauss(conjoined.h)
    # sprint(s)
    # print(conjoined.legs)
    # if d <= 8:
    #     print(TensorStabilizerCodeEnumerator(conjoined.h).stabilizer_enumerator(10))

    #  {0: 1, 2: 6, 4: 24, 6: 90, 8: 135}
    # {0: 1, 2: 6, 4: 24, 6: 90, 8: 135}
    # enumerator: {0: 1,  2: 3, 4: 15, 6: 21, 8: 24}
    # for gi, g in enumerate(s):
    #     for v in [
    #         (
    #             conjoined.legs[idx][0]
    #             if idx < conjoined.n
    #             else conjoined.legs[idx - conjoined.n][0]
    #         )
    #         for idx in np.nonzero(g)[0]
    #     ]:

    #         print(f"{gi} -- n{v[0]}_{v[1]}")


def cotengra_fun(tn: TensorNetwork):
    # Dictionary to store the index for each leg
    leg_indices = {}
    index_to_legs = {}
    # Start with the first letter of the alphabet
    current_index = 0

    free_legs = []
    # Iterate over each node in the tensor network
    for node_idx, node in tn.nodes.items():
        # Iterate over each leg in the node
        for leg in node.legs:
            current_idx_name = f"i{current_index}"
            # If the leg is already indexed, skip it
            if leg in leg_indices:
                continue

            # Assign the current index to the leg
            leg_indices[leg] = current_idx_name
            index_to_legs[current_idx_name] = [(node_idx, leg)]

            open_leg = True
            # Check for traces and assign the same index to traced legs
            for node_idx1, node_idx2, join_legs1, join_legs2 in tn.traces:
                idx = -1
                if leg in join_legs1:
                    idx = join_legs1.index(leg)
                elif leg in join_legs2:
                    idx = join_legs2.index(leg)
                else:
                    continue
                open_leg = False
                leg_indices[join_legs1[idx]] = current_idx_name
                leg_indices[join_legs2[idx]] = current_idx_name
                index_to_legs[current_idx_name] = [
                    (node_idx1, join_legs1[idx]),
                    (node_idx2, join_legs2[idx]),
                ]
            #
            # Move to the next inde
            # x
            if open_leg:
                free_legs.append(leg)
            current_index += 1

    print("free legs: ", free_legs)
    inputs = []
    output = tuple(leg_indices[leg] for leg in free_legs)
    print("outputs: ", output)
    size_dict = {leg: 4 for leg in leg_indices.values()}

    input_names = []
    # Print the indices for each node
    for node_idx, node in tn.nodes.items():
        print(f"Node {node_idx}:")
        inputs.append(tuple(leg_indices[leg] for leg in node.legs))
        input_names.append(node_idx)

        for leg in node.legs:

            print(
                f"  Leg {leg}: Index {leg_indices[leg]} {'OPEN' if leg in free_legs else 'traced'}"
            )

    print(input_names)
    print(inputs)
    print(output)
    print(size_dict)

    # ctg.HyperGraph(inputs, output, size_dict).plot(ax=plt.gca())
    opt = ctg.HyperOptimizer(
        minimize="combo",
        reconf_opts={},
        progbar=True,
    )

    tree: ctg.ContractionTree = opt.search(inputs, output, size_dict)
    print(type(tree))
    print(tree.contraction_width(), tree.contraction_cost())

    def legs_to_contract(l: frozenset, r: frozenset):
        res = []
        left_indices = sum((list(inputs[leaf_idx]) for leaf_idx in l), [])
        right_indices = sum((list(inputs[leaf_idx]) for leaf_idx in r), [])
        for idx1 in left_indices:
            if idx1 in right_indices:
                legs = index_to_legs[idx1]
                res.append((legs[0][0], legs[1][0], [legs[0][1]], [legs[1][1]]))
        return res

    # leaves = list(tree.gen_leaves())
    # I want to convert the tree to a list of traces
    traces = []
    for parent, l, r in tree.traverse():
        # at each step we have to find the nodes that share indices in the two merged subsets
        # print((i, j), (inputs[i], inputs[j]), (leaves[i], leaves[j]))
        new_traces = legs_to_contract(l, r)
        print(parent, l, r, new_traces)
        traces += new_traces

    trace_indices = []
    for t in traces:
        idx = tn.traces.index(t)
        trace_indices.append(idx)
        print(t, idx if t in tn.traces else "NOT in TN")

    assert set(trace_indices) == set(range(len(tn.traces))), "Some traces are missing!"

    return traces
    #     print(input_names[i], input_names[j])
    #     # print(traces[pair])

    # print(json.dumps({str(k): v for k, v in tree.info.items()}, indent=4))
    # tree.plot_tent()
    # tree.print_contractions()
    # tree.plot_contractions()
    # print(tree.flat_tree())


def compass_code_from_tanner():
    hz = GF2(
        [
            [1, 1, 0, 1, 1, 0, 1, 1, 0],
            [0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 1, 1],
        ]
    )

    hx = GF2(
        [
            [1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 1],
        ]
    )

    # hz = GF2([[1, 1, 1, 1]])
    # hx = GF2([[1, 1, 1, 1]])
    tn = TensorNetwork.from_css_parity_check_matrix(hx, hz)

    print(
        "enumerator:",
        tn.stabilizer_enumerator_polynomial(
            # legs=[(f"q{i}", 0) for i in range(hx.shape[1])],
            verbose=False,
            progress_reporter=TqdmProgressReporter(),
            summed_legs=[(f"q{i}", 0) for i in range(hx.shape[1])],
        ),
    )

    # conjoined = tn.conjoin_nodes(verbose=False)
    # print("---")
    # sprint(conjoined.h)

    # for leg in [(f"q{i}", 0) for i in range(hx.shape[1])]:
    #     conjoined = conjoined.trace_with_stopper(PAULI_I, leg)
    # print("after tracing out the logical legs---")

    # sprint(conjoined.h)
    # print(conjoined.legs)

    # print(conjoined.stabilizer_enumerator_polynomial())
    # tn.stabilizer_enumerator_polynomial()
    # tn.analyze_traces()
    # cotengra_fun(tn)


# Example usage
# Assuming `tn` is an instance of TensorNetwork
# extract_leg_indices(tn)


def time_compass_code_cotengra_contraction():
    d = 10
    coloring = np.random.RandomState(0).randint(1, 3, (d - 1, d - 1))
    # coloring = [
    #     [2, 1],
    #     [1, 1],
    # ]
    print(repr(coloring))
    tn = CompassCodeTN(
        coloring=coloring, lego=lambda node: Legos.enconding_tensor_512_z
    )
    tn.analyze_traces(cotengra=True, minimize="combo", max_repeats=300)
    start = time.time()
    print(
        tn.stabilizer_enumerator_polynomial(
            verbose=False, progress_reporter=TqdmProgressReporter(), cotengra=True
        )
    )

    end = time.time()
    print(f"total time {end-start:0.1f} s")


if __name__ == "__main__":
    # import faulthandler

    # faulthandler.enable()
    # time_compass_code_cotengra_contraction()

    tn = CompassCodeTN(
        coloring=np.array(
            [
                [2, 2, 2, 2],
                [2, 2, 1, 2],
                [2, 2, 2, 2],
                [2, 2, 2, 2],
            ]
        )
    )
    wep = tn.stabilizer_enumerator_polynomial(
        verbose=False, progress_reporter=TqdmProgressReporter(), cotengra=True
    )
    print(wep)
