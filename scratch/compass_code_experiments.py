import sys
from galois import GF2
from matplotlib import pyplot as plt
import numpy as np

from legos import Legos
from linalg import gauss
from parity_check import sprint
from scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from tensor_stabilizer_enumerator import (
    PAULI_X,
    PAULI_Z,
    TensorNetwork,
    TensorStabilizerCodeEnumerator,
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

    d = 10

    tn = TensorNetwork.make_surface_code(
        d,
        lambda idx: (Legos.econding_tensor_512_z),
    )

    # coloring = np.array(
    #     [
    #         [1, 1],
    #         [2, 1],
    #     ]
    # )

    coloring = np.random.randint(1, 2, (6, 6))

    gauge_idxs = [
        (r, c) for r in range(1, 2 * d - 1, 2) for c in range(1, 2 * d - 1, 2)
    ]
    for n, color in zip(gauge_idxs, coloring.reshape(coloring.size)):
        tn.nodes[n] = tn.nodes[n].trace_with_stopper(
            PAULI_Z if color == 2 else PAULI_X, 4
        )

    tn.analyze_traces()

    print(
        "WEP from TN:",
        tn.stabilizer_enumerator_polynomial(progress_bar=True),
    )

    conjoined = tn.conjoin_nodes()
    # for leg in [(idx, 4) for idx in tn.nodes.keys() if idx[0] % 2 == 1]:
    #     conjoined = conjoined.trace_with_stopper(PAULI_Z, leg)

    np.set_printoptions(threshold=sys.maxsize, linewidth=800)

    s = gauss(conjoined.h)
    sprint(s)
    print(conjoined.legs)
    if d <= 8:
        print(ScalarStabilizerCodeEnumerator(conjoined.h).stabilizer_enumerator(10))

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


def cotengra_fun(tensor_network: TensorNetwork):
    # Dictionary to store the index for each leg
    leg_indices = {}
    # Start with the first letter of the alphabet
    current_index = 0

    free_legs = []
    # Iterate over each node in the tensor network
    for node_idx, node in tensor_network.nodes.items():
        # Iterate over each leg in the node
        for leg in node.legs:
            # If the leg is already indexed, skip it
            if leg in leg_indices:
                continue

            # Assign the current index to the leg
            leg_indices[leg] = f"i{current_index}"

            open_leg = True
            # Check for traces and assign the same index to traced legs
            for node_idx1, node_idx2, join_legs1, join_legs2 in tensor_network.traces:
                idx = -1
                if leg in join_legs1:
                    idx = join_legs1.index(leg)
                elif leg in join_legs2:
                    idx = join_legs2.index(leg)
                else:
                    continue
                open_leg = False
                leg_indices[join_legs1[idx]] = f"i{current_index}"
                leg_indices[join_legs2[idx]] = f"i{current_index}"
            #
            # Move to the next inde
            # x
            if open_leg:
                free_legs.append(leg)
            current_index += 1

    inputs = []
    output = tuple(leg_indices[leg] for leg in free_legs)
    size_dict = {leg: 4 for leg in leg_indices.values()}

    # Print the indices for each node
    for node_idx, node in tensor_network.nodes.items():
        print(f"Node {node_idx}:")
        inputs.append(tuple(leg_indices[leg] for leg in node.legs))

        for leg in node.legs:

            print(
                f"  Leg {leg}: Index {leg_indices[leg]} {'OPEN' if leg in free_legs else 'traced'}"
            )

    print(inputs)
    print(output)
    print(size_dict)

    ctg.HyperGraph(inputs, output, size_dict).plot(ax=plt.gca())
    opt = ctg.HyperOptimizer()

    tree = opt.search(inputs, output, size_dict)
    print(tree)
    tree.plot_flat()
    print(tree.contraction_width(), tree.contraction_cost())


# Example usage
# Assuming `tn` is an instance of TensorNetwork
# extract_leg_indices(tn)
if __name__ == "__main__":

    # hz = GF2(
    #     [
    #         [1, 1, 0, 1, 1, 0, 1, 1, 0],
    #         [0, 1, 1, 0, 0, 0, 0, 0, 0],
    #         [0, 0, 0, 0, 1, 1, 0, 1, 1],
    #     ]
    # )

    # hx = GF2(
    #     [
    #         [1, 0, 0, 1, 0, 0, 0, 0, 0],
    #         [0, 1, 1, 0, 1, 1, 0, 0, 0],
    #         [0, 0, 0, 1, 0, 0, 1, 0, 0],
    #         [0, 0, 0, 0, 1, 0, 0, 1, 0],
    #         [0, 0, 0, 0, 0, 1, 0, 0, 1],
    #     ]
    # )

    hz = GF2([[1, 1, 1, 1]])
    hx = GF2([[1, 1, 1, 1]])
    tn = TensorNetwork.from_css_parity_check_matrix(hx, hz)
    print("enumerator:", tn.stabilizer_enumerator_polynomial(verbose=True))
    # tn.analyze_traces()
    # cotengra_fun(tn)
