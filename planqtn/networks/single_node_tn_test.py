from galois import GF2
from planqtn.networks.rotated_surface_code import RotatedSurfaceCodeTN
from planqtn.networks.single_node_tn import SingleNodeTensorNetwork
from planqtn.legos import Legos
from planqtn.simple_poly import SimplePoly
from planqtn.tensor_network import StabilizerCodeTensorEnumerator


def test_d3_rsc_joint_z_coset():
    tn = RotatedSurfaceCodeTN(d=3, lego=lambda i: Legos.enconding_tensor_512_z)
    print([tn.qubit_to_node_and_leg(q) for q in range(tn.n_qubits())])
    tn = SingleNodeTensorNetwork(tn.conjoin_nodes())
    print("----")
    tn.set_coset(
        coset_error=(
            (),
            # warning - the leg indices are messed up after conjoin_nodes()!
            (tn.node.legs.index(((0, 0), 4)), tn.node.legs.index(((2, 1), 4))),
        )
    )

    print(repr(tn.node.h))
    print(tn.node.legs)
    we = tn.stabilizer_enumerator_polynomial()
    expected = SimplePoly(
        {
            2: 1,
            4: 10,
            6: 5,
        }
    )
    assert we == expected, f"Not equal: {we} vs {expected} (expected)"


def test_d3_rsc_joint_z_coset2():
    tn = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
            ]
        ),
        coset_flipped_legs=[
            ((0, 0), GF2([0, 1])),
            ((0, 5), GF2([0, 1])),
        ],
    )
    print("----")

    print(tn.h)
    print(tn.legs)
    we = tn.stabilizer_enumerator_polynomial()
    expected = SimplePoly(
        {
            2: 1,
            4: 10,
            6: 5,
        }
    )
    assert we == expected, f"Not equal: {we} vs {expected} (expected)"
