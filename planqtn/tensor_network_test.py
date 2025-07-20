import numpy as np
import pytest
from galois import GF2

from planqtn.legos import Legos
from planqtn.parity_check import tensor_product
from planqtn.pauli import Pauli
from planqtn.progress_reporter import TqdmProgressReporter
from planqtn.symplectic import sslice, weight
from planqtn.tensor_network import (
    PAULI_I,
    PAULI_X,
    PAULI_Z,
    SimplePoly,
    StabilizerCodeTensorEnumerator,
    TensorNetwork,
)


def test_trace_two_422_codes_into_steane_via_tensornetwork():
    enc_tens_422 = GF2(
        [
            # fmt: off
    #        l1,2            l1,2 
    [1,1,1,1, 0,0,  0,0,0,0,  0,0],
    [0,0,0,0, 0,0,  1,1,1,1,  0,0], 
    # X1
    [1,1,0,0, 1,0,  0,0,0,0,  0,0],
    # X2
    [1,0,0,1, 0,1,  0,0,0,0,  0,0],       
    # Z2
    [0,0,0,0, 0,0,  1,1,0,0,  0,1],
    # Z1
    [0,0,0,0, 0,0,  1,0,0,1,  1,0],
            # fmt: on
        ]
    )

    t1 = StabilizerCodeTensorEnumerator(enc_tens_422, tensor_id=0).trace_with_stopper(
        PAULI_I, 0
    )
    t2 = StabilizerCodeTensorEnumerator(enc_tens_422, tensor_id=1)

    tn = TensorNetwork(nodes=[t1, t2])
    tn.self_trace(0, 1, [4], [4])
    tn.self_trace(0, 1, [5], [5])

    assert {6: 42, 4: 21, 0: 1} == tn.stabilizer_enumerator_polynomial(
        verbose=True
    ).dict


def test_step_by_step_to_d2_surface_code():
    pytest.skip("Fix later for tracewith and stuff")
    # see fig/d2_surface_code.png for the numberings

    enc_tens_512 = GF2(
        [
            # fmt: off
    #        l1,2            l1,2 
    [1,1,1,1, 0,  0,0,0,0,  0,],
    [0,0,0,0, 0,  1,1,1,1,  0,], 
    # X1
    [1,1,0,0, 1,  0,0,0,0,  0,],        
    # Z1
    [0,0,0,0, 0,  0,1,1,0,  1,],
            # fmt: on
        ]
    )

    t0 = (
        StabilizerCodeTensorEnumerator(enc_tens_512, tensor_id=0)
        .trace_with_stopper(PAULI_Z, 3)
        .trace_with_stopper(PAULI_X, 0)
    )

    t1 = (
        StabilizerCodeTensorEnumerator(enc_tens_512, tensor_id=1)
        .trace_with_stopper(PAULI_Z, 0)
        .trace_with_stopper(PAULI_X, 3)
    )

    ### Getting Conjoined Parities brute force WEP

    h_pte = t0.conjoin(t1, [2], [1])

    print(h_pte.legs)
    print(h_pte.h)

    for i in range(2 ** (len(h_pte.h))):
        picked_generators = GF2(list(np.binary_repr(i, width=len(h_pte.h))), dtype=int)
        stabilizer = picked_generators @ h_pte.h
        print(
            stabilizer,
            weight(stabilizer),
            sslice(stabilizer, [1, 2]),
            weight(stabilizer, [1, 2]),
        )

    ### Checking PartiallyTracedEnumerator equivalence

    pte = t0.trace_with(
        t1,
        join_legs1=[2],
        join_legs2=[1],
        open_legs1=[1, 4],
        open_legs2=[2, 4],
    )

    assert pte.nodes == {0, 1}
    assert pte.tracable_legs == [(0, 1), (0, 4), (1, 2), (1, 4)]

    total_wep = SimplePoly()
    for k, sub_wep in pte.tensor.items():

        print(k, "->", sub_wep, sub_wep * SimplePoly({weight(GF2(k)): 1}))
        total_wep.add_inplace(sub_wep * SimplePoly({weight(GF2(k)): 1}))

    assert brute_force_wep == total_wep.dict

    ### Checking TensorNetwork equivalence

    tn = TensorNetwork([t0, t1])
    tn.self_trace(0, 1, [2], [1])

    tn_wep = tn.stabilizer_enumerator_polynomial(verbose=True)

    assert total_wep == tn_wep

    ################ NODE 2 ###################

    t2 = (
        StabilizerCodeTensorEnumerator(enc_tens_512, tensor_id=2)
        .trace_with_stopper(PAULI_X, 1)
        .trace_with_stopper(PAULI_Z, 2)
    )

    ### Getting Conjoined Parities brute force WEP

    # H PTE
    #   1 4 7 9
    #  [0 0 0 0 | 1 1 1 0]
    #  [0 0 1 1 | 0 0 0 0]
    #  [1 1 0 0 | 0 0 0 0]
    h_pte = h_pte.conjoin(t2, [1], [0])
    print("H pte (t0,t1,t2)")
    print(h_pte.h)
    print(h_pte.legs)

    for i in range(2 ** (len(h_pte.h))):
        picked_generators = GF2(list(np.binary_repr(i, width=len(h_pte.h))), dtype=int)
        stabilizer = picked_generators @ h_pte.h
        print(
            stabilizer,
            weight(stabilizer),
            sslice(stabilizer, [1, 2]),
            weight(stabilizer, [1, 2]),
        )

    ### Checking PartiallyTracedEnumerator equivalence

    pte = pte.trace_with(
        t2,
        join_legs1=[(0, 1)],
        join_legs2=[0],
        open_legs1=[(0, 4), (1, 2), (1, 4)],
        open_legs2=[3, 4],
    )

    assert pte.nodes == {0, 1, 2}
    assert pte.tracable_legs == [(0, 4), (1, 2), (1, 4), (2, 3), (2, 4)]

    total_wep = SimplePoly()
    for k, sub_wep in pte.tensor.items():

        print(
            k,
            "->",
            sub_wep,
            sub_wep * SimplePoly({weight(GF2(k)): 1}),
        )
        total_wep.add_inplace(sub_wep * SimplePoly({weight(GF2(k)): 1}))

    assert brute_force_wep == dict(total_wep.dict)

    ### Checking TensorNetwork equivalence

    tn = TensorNetwork([t0, t1, t2])
    tn.self_trace(0, 1, [2], [1])
    tn.self_trace(0, 2, [1], [0])

    tn_wep = tn.stabilizer_enumerator_polynomial(verbose=True)

    assert total_wep == tn_wep

    ################ NODE 3 ###################

    t3 = (
        StabilizerCodeTensorEnumerator(enc_tens_512, tensor_id=3)
        .trace_with_stopper(PAULI_X, 2)
        .trace_with_stopper(PAULI_Z, 1)
    )

    ### Getting Conjoined Parities brute force WEP

    # H PTE (t0, t1, t2 )
    #   4 -> (0,4) ("logical")
    #   7 -> (1,2)
    #   9 -> (1,4) ("logical")
    #   13 ->(2,3)
    #   14 ->(2,4) ("logical")
    #  [4 7 9 13 14]
    # [[1 0 0 0 1 0 0 0 0 0]
    #  [0 0 0 0 0 1 1 0 1 1]
    #  [0 1 1 0 0 0 0 0 0 0]]

    print(h_pte.legs)
    h_pte = h_pte.conjoin(t3, [(2, 3), (1, 2)], [(3, 0), (3, 3)])
    print("H pte (t0,t1,t2,t3)")
    print(h_pte.h)
    print(h_pte.legs)

    ### Checking PartiallyTracedEnumerator equivalence

    pte = pte.trace_with(
        t3,
        join_legs1=[(2, 3), (1, 2)],
        join_legs2=[0, 3],
        open_legs1=[(0, 4), (1, 4), (2, 4)],
        open_legs2=[(3, 4)],
    )

    assert pte.nodes == {0, 1, 2, 3}
    assert pte.tracable_legs == [(0, 4), (1, 4), (2, 4), (3, 4)]

    total_wep = SimplePoly()
    for k, sub_wep in pte.tensor.items():

        print(
            k,
            "->",
            sub_wep,
            sub_wep * SimplePoly({weight(GF2(k)): 1}),
        )
        total_wep.add_inplace(sub_wep * SimplePoly({weight(GF2(k)): 1}))

    assert brute_force_wep == dict(total_wep.dict)

    assert np.array_equal(
        h_pte.h,
        GF2(
            [
                [0, 1, 0, 1, 0, 0, 0, 0],
                [0, 0, 0, 0, 1, 1, 1, 1],
                [1, 0, 1, 0, 0, 0, 0, 0],
            ]
        ),
    ), f"not equal\n{h_pte.h}"

    ### Checking TensorNetwork equivalence
    print(
        "=============================== final TN check ==============================="
    )

    tn = TensorNetwork([t0, t1, t2, t3])
    tn.self_trace(0, 1, [2], [1])
    tn.self_trace(0, 2, [1], [0])
    tn.self_trace(2, 3, [3], [0])
    tn.self_trace(3, 1, [3], [2])

    tn_wep = tn.stabilizer_enumerator_polynomial()
    assert tn_wep == total_wep, f"not equal:\n{tn_wep}"


def test_double_trace_422():
    enc_tens_422 = GF2(
        [
            # fmt: off
    #        l1,2            l1,2 
    [1,1,1,1, 0,0,  0,0,0,0,  0,0],
    [0,0,0,0, 0,0,  1,1,1,1,  0,0], 
    # X1
    [1,1,0,0, 1,0,  0,0,0,0,  0,0],
    # X2
    [1,0,0,1, 0,1,  0,0,0,0,  0,0],       
    # Z2
    [0,0,0,0, 0,0,  1,1,0,0,  0,1],
    # Z1
    [0,0,0,0, 0,0,  1,0,0,1,  1,0],
            # fmt: on
        ]
    )
    nodes = [
        StabilizerCodeTensorEnumerator(enc_tens_422, tensor_id=0)
        .trace_with_stopper(PAULI_I, 4)
        .trace_with_stopper(PAULI_I, 5),
        StabilizerCodeTensorEnumerator(enc_tens_422, tensor_id=1)
        .trace_with_stopper(PAULI_I, 4)
        .trace_with_stopper(PAULI_I, 5),
    ]

    tn = TensorNetwork(nodes)
    tn.self_trace(0, 1, [1], [2])
    tn.self_trace(0, 1, [2], [1])

    wep = tn.stabilizer_enumerator()
    print(wep)

    assert wep == {4: 3, 0: 1}


def test_temporarily_disjoint_nodes():

    nodes = {}
    nodes["encoding_tensor_512-1741469569037-dtap10r8u"] = (
        StabilizerCodeTensorEnumerator(
            h=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
                ]
            ),
            tensor_id="encoding_tensor_512-1741469569037-dtap10r8u",
        )
    )
    nodes["stopper_x-1741469771579-66rik1482"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        tensor_id="stopper_x-1741469771579-66rik1482",
    )
    nodes["stopper_z-1741469873935-7x8lepkz0"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        tensor_id="stopper_z-1741469873935-7x8lepkz0",
    )
    nodes["encoding_tensor_512-1741469573383-vywzti2i7"] = (
        StabilizerCodeTensorEnumerator(
            h=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
                ]
            ),
            tensor_id="encoding_tensor_512-1741469573383-vywzti2i7",
        )
    )
    nodes["encoding_tensor_512-1741469806847-zh6tym4ir"] = (
        StabilizerCodeTensorEnumerator(
            h=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
                ]
            ),
            tensor_id="encoding_tensor_512-1741469806847-zh6tym4ir",
        )
    )
    nodes["stopper_x-1741469775700-mqqxo9prq"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        tensor_id="stopper_x-1741469775700-mqqxo9prq",
    )
    nodes["encoding_tensor_512-1741469792957-3buy4eynz"] = (
        StabilizerCodeTensorEnumerator(
            h=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
                ]
            ),
            tensor_id="encoding_tensor_512-1741469792957-3buy4eynz",
        )
    )
    nodes["encoding_tensor_512-1741469808602-uoj183v5a"] = (
        StabilizerCodeTensorEnumerator(
            h=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
                ]
            ),
            tensor_id="encoding_tensor_512-1741469808602-uoj183v5a",
        )
    )
    nodes["stopper_z-1741469888356-0g4nnrhvn"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        tensor_id="stopper_z-1741469888356-0g4nnrhvn",
    )
    nodes["encoding_tensor_512-1741469811429-2iso8lzh2"] = (
        StabilizerCodeTensorEnumerator(
            h=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
                ]
            ),
            tensor_id="encoding_tensor_512-1741469811429-2iso8lzh2",
        )
    )
    nodes["stopper_x-1741469797022-mxbutnmk4"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        tensor_id="stopper_x-1741469797022-mxbutnmk4",
    )
    nodes["stopper_z-1741469886390-bi1budt2m"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        tensor_id="stopper_z-1741469886390-bi1budt2m",
    )
    nodes["encoding_tensor_512-1741469809666-boitky627"] = (
        StabilizerCodeTensorEnumerator(
            h=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
                ]
            ),
            tensor_id="encoding_tensor_512-1741469809666-boitky627",
        )
    )
    nodes["encoding_tensor_512-1741469812426-63xr66brk"] = (
        StabilizerCodeTensorEnumerator(
            h=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
                ]
            ),
            tensor_id="encoding_tensor_512-1741469812426-63xr66brk",
        )
    )
    nodes["stopper_x-1741469821306-v1lj0052l"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        tensor_id="stopper_x-1741469821306-v1lj0052l",
    )
    nodes["stopper_z-1741469890980-mrvl1054y"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        tensor_id="stopper_z-1741469890980-mrvl1054y",
    )
    nodes["stopper_z-1741469892323-ur5jgaa88"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        tensor_id="stopper_z-1741469892323-ur5jgaa88",
    )
    nodes["encoding_tensor_512-1741469813386-3cidseuj5"] = (
        StabilizerCodeTensorEnumerator(
            h=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
                ]
            ),
            tensor_id="encoding_tensor_512-1741469813386-3cidseuj5",
        )
    )
    nodes["stopper_x-1741469823864-5miztfum6"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        tensor_id="stopper_x-1741469823864-5miztfum6",
    )
    nodes["stopper_x-1741469826392-9ruhud11d"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        tensor_id="stopper_x-1741469826392-9ruhud11d",
    )
    nodes["stopper_z-1741469893043-9dwerhtds"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        tensor_id="stopper_z-1741469893043-9dwerhtds",
    )

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=None)

    # Add traces
    tn.self_trace(
        "stopper_x-1741469771579-66rik1482",
        "encoding_tensor_512-1741469569037-dtap10r8u",
        [0],
        [3],
    )
    tn.self_trace(
        "stopper_x-1741469797022-mxbutnmk4",
        "encoding_tensor_512-1741469792957-3buy4eynz",
        [0],
        [3],
    )
    tn.self_trace(
        "stopper_x-1741469821306-v1lj0052l",
        "encoding_tensor_512-1741469811429-2iso8lzh2",
        [0],
        [1],
    )
    tn.self_trace(
        "stopper_x-1741469826392-9ruhud11d",
        "encoding_tensor_512-1741469813386-3cidseuj5",
        [0],
        [1],
    )
    tn.self_trace(
        "stopper_x-1741469775700-mqqxo9prq",
        "encoding_tensor_512-1741469573383-vywzti2i7",
        [0],
        [0],
    )
    tn.self_trace(
        "stopper_z-1741469873935-7x8lepkz0",
        "encoding_tensor_512-1741469569037-dtap10r8u",
        [0],
        [0],
    )
    tn.self_trace(
        "stopper_z-1741469888356-0g4nnrhvn",
        "encoding_tensor_512-1741469806847-zh6tym4ir",
        [0],
        [1],
    )
    tn.self_trace(
        "stopper_z-1741469886390-bi1budt2m",
        "encoding_tensor_512-1741469792957-3buy4eynz",
        [0],
        [2],
    )
    tn.self_trace(
        "stopper_z-1741469892323-ur5jgaa88",
        "encoding_tensor_512-1741469809666-boitky627",
        [0],
        [3],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469569037-dtap10r8u",
        "encoding_tensor_512-1741469573383-vywzti2i7",
        [2],
        [1],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469569037-dtap10r8u",
        "encoding_tensor_512-1741469806847-zh6tym4ir",
        [1],
        [0],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469573383-vywzti2i7",
        "encoding_tensor_512-1741469792957-3buy4eynz",
        [3],
        [0],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469573383-vywzti2i7",
        "encoding_tensor_512-1741469808602-uoj183v5a",
        [2],
        [3],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469808602-uoj183v5a",
        "encoding_tensor_512-1741469809666-boitky627",
        [2],
        [1],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469806847-zh6tym4ir",
        "encoding_tensor_512-1741469808602-uoj183v5a",
        [3],
        [0],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469806847-zh6tym4ir",
        "encoding_tensor_512-1741469811429-2iso8lzh2",
        [2],
        [3],
    )
    tn.self_trace(
        "stopper_z-1741469890980-mrvl1054y",
        "encoding_tensor_512-1741469811429-2iso8lzh2",
        [0],
        [0],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469811429-2iso8lzh2",
        "encoding_tensor_512-1741469812426-63xr66brk",
        [2],
        [1],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469812426-63xr66brk",
        "encoding_tensor_512-1741469813386-3cidseuj5",
        [3],
        [0],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469812426-63xr66brk",
        "stopper_x-1741469823864-5miztfum6",
        [2],
        [0],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469808602-uoj183v5a",
        "encoding_tensor_512-1741469812426-63xr66brk",
        [1],
        [0],
    )
    tn.self_trace(
        "stopper_z-1741469893043-9dwerhtds",
        "encoding_tensor_512-1741469813386-3cidseuj5",
        [0],
        [2],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469809666-boitky627",
        "encoding_tensor_512-1741469813386-3cidseuj5",
        [2],
        [3],
    )
    tn.self_trace(
        "encoding_tensor_512-1741469792957-3buy4eynz",
        "encoding_tensor_512-1741469809666-boitky627",
        [1],
        [0],
    )

    node = tn.conjoin_nodes(verbose=True)
    assert node.h.shape == (8, 18)

    we = node.stabilizer_enumerator_polynomial()
    assert we.dict == {8: 129, 6: 100, 4: 22, 2: 4, 0: 1}


def test_double_trace_602_identity_stopper_to_422():

    nodes = {}
    nodes["0"] = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
                [1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0],
                [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1],
            ]
        ),
        tensor_id="0",
    )
    nodes["stop1"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 0]]),
        tensor_id="stop1",
    )
    nodes["stop2"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 0]]),
        tensor_id="stop2",
    )

    print(nodes["stop1"].stabilizer_enumerator_polynomial())

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=None)

    # Add traces
    tn.self_trace(
        "stop1",
        "0",
        [0],
        [4],
    )
    tn.self_trace(
        "stop2",
        "0",
        [0],
        [5],
    )

    conjoined = tn.conjoin_nodes()
    assert np.array_equal(conjoined.h, Legos.stab_code_parity_422)

    assert tn.stabilizer_enumerator_polynomial(
        verbose=True, progress_reporter=TqdmProgressReporter()
    ).dict == {0: 1, 4: 3}


def test_tensor_product_of_legos():
    tn = TensorNetwork(
        [
            StabilizerCodeTensorEnumerator(tensor_id=0, h=Legos.enconding_tensor_512),
            StabilizerCodeTensorEnumerator(tensor_id=1, h=Legos.enconding_tensor_512),
        ],
        truncate_length=None,
    )
    conjoined = tn.conjoin_nodes(verbose=True)

    assert np.array_equal(
        conjoined.h,
        tensor_product(Legos.enconding_tensor_512, Legos.enconding_tensor_512),
    )


def test_twisted_toric_code():

    nodes = {}
    nodes["1"] = StabilizerCodeTensorEnumerator(
        # fmt: off
        h=GF2([[1, 1, 1, 1, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1, 1, 1, 1, 0], [1, 1, 0, 0, 1, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]]),
        # fmt: on
        tensor_id="1",
    )
    nodes["34"] = StabilizerCodeTensorEnumerator(
        # fmt: off
        h=GF2([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1], [0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1], [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]),
        # fmt: on
        tensor_id="34",
    )

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=None)

    # Add traces
    tn.self_trace("1", "34", [3], [13])
    tn.self_trace("1", "34", [0], [4])
    tn.self_trace("1", "34", [1], [0])
    tn.self_trace("1", "34", [2], [11])

    poly = tn.stabilizer_enumerator_polynomial(
        verbose=True, progress_reporter=TqdmProgressReporter(), cotengra=False
    )

    assert poly[0] == 1


def test_quadruple_trace_422_into_422():
    nodes = {}
    nodes["18"] = StabilizerCodeTensorEnumerator(
        h=Legos.enconding_tensor_512,
        tensor_id="18",
    )
    nodes["19"] = StabilizerCodeTensorEnumerator(
        h=Legos.enconding_tensor_512,
        tensor_id="19",
    )

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=None)

    # Add traces
    tn.self_trace("18", "19", [0], [0])
    tn.self_trace("18", "19", [1], [1])
    tn.self_trace("18", "19", [2], [2])
    tn.self_trace("18", "19", [3], [3])

    # tn.conjoin_nodes(verbose=True, progress_reporter=TqdmProgressReporter())

    assert tn.stabilizer_enumerator_polynomial(
        verbose=True,
        progress_reporter=TqdmProgressReporter(),
    ).dict == {0: 1, 2: 3}


def test_two_bell_states():
    tn = TensorNetwork(
        nodes={
            "0": StabilizerCodeTensorEnumerator(
                h=GF2(
                    [
                        [1, 1, 0, 0],
                        [0, 0, 1, 1],
                    ]
                ),
                tensor_id="0",
            ),
            "1": StabilizerCodeTensorEnumerator(
                h=GF2(
                    [
                        [1, 1, 0, 0],
                        [0, 0, 1, 1],
                    ]
                ),
                tensor_id="1",
            ),
        }
    )
    assert tn.stabilizer_enumerator_polynomial(
        verbose=True,
        progress_reporter=TqdmProgressReporter(),
    ).dict == {0: 1, 2: 6, 4: 9}


def test_two_512_tensor_merge_step_by_step():

    # Create TensorNetwork

    traces = [
        ("1", "2", [0], [0]),
        ("1", "2", [1], [1]),
        ("1", "2", [2], [2]),
        ("1", "2", [3], [3]),
    ]

    for i in range(len(traces) + 1):
        nodes = {}
        nodes["1"] = StabilizerCodeTensorEnumerator(
            h=Legos.enconding_tensor_512,
            tensor_id="1",
        )
        nodes["2"] = StabilizerCodeTensorEnumerator(
            h=Legos.enconding_tensor_512,
            tensor_id="2",
        )

        tn = TensorNetwork(nodes, truncate_length=None)

        print("-----------------------------------------------")
        print(f"-------------------step {i}-------------------")
        print("-----------------------------------------------")

        open_legs = []
        for trace in traces[:i]:
            tn.self_trace(*trace)

        for trace in traces[i:]:
            open_legs.append((trace[0], trace[2][0]))
            open_legs.append((trace[1], trace[3][0]))
        print("open_legs", open_legs)

        print("============== CONJOINED WEP ================================")
        conjoined_wep = tn.conjoin_nodes().stabilizer_enumerator_polynomial(
            verbose=True,
            progress_reporter=TqdmProgressReporter(),
            open_legs=open_legs,
        )
        conjoined_wep_str = (
            str(conjoined_wep)
            if isinstance(conjoined_wep, SimplePoly)
            else "\n".join(
                sorted([f"{Pauli.to_str(*k)}: {v}" for k, v in conjoined_wep.items()])
            )
        )
        print(f"conjoined_wep_str: {conjoined_wep_str}")
        print("============== TN WEP ================================")
        tn_wep = tn.stabilizer_enumerator_polynomial(
            verbose=True,
            progress_reporter=TqdmProgressReporter(),
            open_legs=open_legs,
            cotengra=False,
        )

        tn_wep_str = (
            str(tn_wep)
            if isinstance(tn_wep, SimplePoly)
            else "\n".join(
                sorted([f"{Pauli.to_str(*k)}: {v}" for k, v in tn_wep.items()])
            )
        )
        # with open(f"step_{i}_wep.txt", "w") as f:
        #     f.write(f"{tn_wep_str}")
        # with open(f"step_{i}_conj_wep.txt", "w") as f:
        #     f.write(f"{conjoined_wep_str}")

        assert (
            tn_wep_str == conjoined_wep_str
        ), f"step {i} failed. tnwep:\n{tn_wep_str}\nconj_wep:\n{conjoined_wep_str}"


def test_disconnected_networks():

    nodes = {}
    nodes["25"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 1, 0, 0], [0, 0, 1, 1]]),
        tensor_id="25",
    )
    nodes["27"] = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [1, 1, 1, 1, 0, 0, 0, 0],
            ]
        ),
        tensor_id="27",
    )
    nodes["31"] = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [1, 1, 1, 1, 0, 0, 0, 0],
            ]
        ),
        tensor_id="31",
    )

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=None)

    # Add traces
    tn.self_trace("25", "31", [0], [2])

    wep = tn.stabilizer_enumerator_polynomial(
        verbose=True,
        progress_reporter=TqdmProgressReporter(),
    )
    assert wep.dict == {0: 1, 2: 12, 4: 54, 6: 108, 8: 81}


def test_disconnected_networks_truncate_length():

    nodes = {}
    nodes["25"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 1, 0, 0], [0, 0, 1, 1]]),
        tensor_id="25",
    )
    nodes["27"] = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [1, 1, 1, 1, 0, 0, 0, 0],
            ]
        ),
        tensor_id="27",
    )
    nodes["31"] = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [1, 1, 1, 1, 0, 0, 0, 0],
            ]
        ),
        tensor_id="31",
    )

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=1)

    # Add traces
    tn.self_trace("25", "31", [0], [2])

    wep = tn.stabilizer_enumerator_polynomial(
        verbose=True,
        progress_reporter=TqdmProgressReporter(),
    )
    assert wep.dict == {
        0: 1,
    }

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=2)

    # Add traces
    tn.self_trace("25", "31", [0], [2])

    wep = tn.stabilizer_enumerator_polynomial(
        verbose=True,
        progress_reporter=TqdmProgressReporter(),
    )
    assert wep.dict == {0: 1, 2: 12}


@pytest.mark.parametrize(
    "truncate_length, expected_wep",
    [
        (None, {6: 42, 4: 21, 0: 1}),
        (1, {0: 1}),
        (2, {0: 1}),
        (4, {0: 1, 4: 21}),
        (6, {0: 1, 4: 21, 6: 42}),
        (9, {0: 1, 4: 21, 6: 42}),
    ],
)
def test_trace_two_422_codes_into_steane_via_tensornetwork_truncated(
    truncate_length, expected_wep
):
    enc_tens_422 = GF2(
        [
            # fmt: off
    #        l1,2            l1,2 
    [1,1,1,1, 0,0,  0,0,0,0,  0,0],
    [0,0,0,0, 0,0,  1,1,1,1,  0,0], 
    # X1
    [1,1,0,0, 1,0,  0,0,0,0,  0,0],
    # X2
    [1,0,0,1, 0,1,  0,0,0,0,  0,0],       
    # Z2
    [0,0,0,0, 0,0,  1,1,0,0,  0,1],
    # Z1
    [0,0,0,0, 0,0,  1,0,0,1,  1,0],
            # fmt: on
        ]
    )

    t1 = StabilizerCodeTensorEnumerator(enc_tens_422, tensor_id=0).trace_with_stopper(
        PAULI_I, 0
    )
    t2 = StabilizerCodeTensorEnumerator(enc_tens_422, tensor_id=1)

    tn = TensorNetwork(nodes=[t1, t2], truncate_length=truncate_length)
    tn.self_trace(0, 1, [4], [4])
    tn.self_trace(0, 1, [5], [5])

    assert (
        expected_wep
        == tn.stabilizer_enumerator_polynomial(
            verbose=True,
        ).dict
    )


def test_truncate_length_example():

    nodes = {}
    nodes["46"] = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [1, 1, 1, 1, 0, 0, 0, 0],
            ]
        ),
        tensor_id="46",
    )
    nodes["47"] = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [1, 1, 1, 1, 0, 0, 0, 0],
            ]
        ),
        tensor_id="47",
    )
    nodes["53"] = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [0, 0, 0, 0, 1, 1, 0, 0],
                [0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 1, 1],
                [1, 1, 1, 1, 0, 0, 0, 0],
            ]
        ),
        tensor_id="53",
    )
    nodes["59"] = StabilizerCodeTensorEnumerator(
        h=GF2(
            [
                [1, 0, 0, 0, 0, 1, 1, 1],
                [0, 0, 1, 1, 0, 0, 0, 0],
                [0, 1, 0, 1, 0, 0, 0, 0],
            ]
        ),
        tensor_id="59",
    )
    nodes["60"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0, 0, 0, 1, 1], [0, 1, 1, 0, 0, 0]]),
        tensor_id="60",
    )
    nodes["61"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0, 0, 0, 1, 1], [0, 1, 1, 0, 0, 0]]),
        tensor_id="61",
    )
    nodes["62"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0, 0, 0, 1, 1], [0, 1, 1, 0, 0, 0]]),
        tensor_id="62",
    )

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=4)

    # Add traces
    tn.self_trace("46", "59", [1], [2])
    tn.self_trace("47", "59", [1], [3])
    tn.self_trace("47", "60", [0], [2])
    tn.self_trace("53", "60", [1], [0])
    tn.self_trace("46", "61", [0], [2])
    tn.self_trace("53", "61", [0], [0])
    tn.self_trace("47", "53", [3], [3])
    tn.self_trace("62", "46", [2], [3])
    tn.self_trace("60", "62", [1], [0])
    tn.self_trace("62", "59", [1], [0])

    assert tn.stabilizer_enumerator_polynomial(
        verbose=True,
    ).dict == {0: 1, 2: 1, 4: 2}


@pytest.mark.parametrize(
    "truncate_length, expected_wep",
    [
        (None, {0: 1, 3: 8, 4: 21, 5: 24, 6: 10}),
        (1, {0: 1}),
        (2, {0: 1}),
        (3, {0: 1, 3: 8}),
        (4, {0: 1, 3: 8, 4: 21}),
        (6, {0: 1, 3: 8, 4: 21, 5: 24, 6: 10}),
        (9, {0: 1, 3: 8, 4: 21, 5: 24, 6: 10}),
    ],
)
def test_single_node_truncate_length(truncate_length, expected_wep):

    nodes = {
        "1": StabilizerCodeTensorEnumerator(
            h=Legos.enconding_tensor_603,
            tensor_id="1",
        ),
    }

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=truncate_length)

    assert (
        tn.stabilizer_enumerator_polynomial(
            verbose=True,
        ).dict
        == expected_wep
    )


def test_tensor_product_with_scalar_0():
    h1 = StabilizerCodeTensorEnumerator(GF2([[0]]), tensor_id="0")
    h2 = StabilizerCodeTensorEnumerator(GF2([[1, 0]]), tensor_id="1")
    tn = TensorNetwork(nodes=[h1, h2])
    assert np.array_equal(tn.conjoin_nodes().h, GF2([[0]]))


def test_tensor_product_with_scalar_1():
    h1 = StabilizerCodeTensorEnumerator(GF2([[1]]), tensor_id="0")
    h2 = StabilizerCodeTensorEnumerator(GF2([[1, 0]]), tensor_id="1")
    tn = TensorNetwork(nodes=[h1, h2])
    assert np.array_equal(tn.conjoin_nodes().h, GF2([[1, 0]]))


def test_single_node_with_open_legs_t6():
    h = Legos.enconding_tensor_603
    te = StabilizerCodeTensorEnumerator(tensor_id="0", h=h)
    tn = TensorNetwork(nodes=[te])
    actual_wep = tn.stabilizer_enumerator_polynomial(
        open_legs=[("0", 0), ("0", 1)], verbose=True
    )
    print(actual_wep)
    assert actual_wep == {
        (0, 0): SimplePoly({0: 1, 3: 2, 4: 1}),
        (0, 2): SimplePoly({3: 2, 2: 1, 4: 1}),
        (2, 0): SimplePoly({2: 1, 3: 2, 4: 1}),
        (2, 2): SimplePoly({1: 1, 2: 1, 4: 1, 3: 1}),
        (0, 1): SimplePoly({3: 2, 4: 1, 2: 1}),
        (0, 3): SimplePoly({3: 2, 4: 2}),
        (2, 1): SimplePoly({3: 2, 4: 2}),
        (2, 3): SimplePoly({3: 2, 4: 1, 2: 1}),
        (1, 0): SimplePoly({2: 1, 3: 2, 4: 1}),
        (1, 2): SimplePoly({3: 2, 4: 2}),
        (3, 0): SimplePoly({3: 2, 4: 2}),
        (3, 2): SimplePoly({2: 1, 3: 2, 4: 1}),
        (1, 1): SimplePoly({1: 1, 4: 1, 2: 1, 3: 1}),
        (1, 3): SimplePoly({3: 2, 2: 1, 4: 1}),
        (3, 1): SimplePoly({2: 1, 3: 2, 4: 1}),
        (3, 3): SimplePoly({2: 2, 3: 2}),
    }
