from copy import deepcopy
import sys
from galois import GF, GF2
import numpy as np
import pytest
import scipy
import sympy
import os

from qlego.codes.surface_code import SurfaceCodeTN
from qlego.legos import Legos
from qlego.linalg import gauss
from qlego.parity_check import conjoin, sprint, sstr, tensor_product
from qlego.symplectic import weight
from qlego.tensor_network import (
    PAULI_I,
    PAULI_X,
    PAULI_Y,
    PAULI_Z,
    SimplePoly,
    TensorNetwork,
    StabilizerCodeTensorEnumerator,
    sconcat,
    sslice,
)

from sympy.abc import w, z
from sympy import Poly


def test_422_physical_legs_off_diagonals():
    pytest.skip("Skipping off diagonal tests")
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
    vec_enum_phys_legs = StabilizerCodeTensorEnumerator(enc_tens_422)
    assert {0: 2} == vec_enum_phys_legs.scalar_stabilizer_enumerator(
        traced_legs=[0, 1, 2, 3], e=GF2([1, 1, 1, 1, 0, 0, 0, 0]), eprime=GF2.Zeros(8)
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

    t1 = StabilizerCodeTensorEnumerator(enc_tens_422, idx=0).trace_with_stopper(
        PAULI_I, 0
    )
    t2 = StabilizerCodeTensorEnumerator(enc_tens_422, idx=1)

    tn = TensorNetwork(nodes=[t1, t2])
    tn.self_trace(0, 1, [4], [4])
    tn.self_trace(0, 1, [5], [5])

    assert {6: 42, 4: 21, 0: 1} == tn.stabilizer_enumerator_polynomial(
        verbose=True
    )._dict


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
        StabilizerCodeTensorEnumerator(enc_tens_512, idx=0)
        .trace_with_stopper(PAULI_Z, 3)
        .trace_with_stopper(PAULI_X, 0)
    )

    t1 = (
        StabilizerCodeTensorEnumerator(enc_tens_512, idx=1)
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

    brute_force_wep = h_pte.scalar_stabilizer_enumerator()
    print(brute_force_wep)

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

    assert brute_force_wep == total_wep._dict

    ### Checking TensorNetwork equivalence

    tn = TensorNetwork([t0, t1])
    tn.self_trace(0, 1, [2], [1])

    tn_wep = tn.stabilizer_enumerator_polynomial(verbose=True)

    assert total_wep == tn_wep

    ################ NODE 2 ###################

    t2 = (
        StabilizerCodeTensorEnumerator(enc_tens_512, idx=2)
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

    brute_force_wep = h_pte.scalar_stabilizer_enumerator()
    print(brute_force_wep)

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

    assert brute_force_wep == dict(total_wep._dict)

    ### Checking TensorNetwork equivalence

    tn = TensorNetwork([t0, t1, t2])
    tn.self_trace(0, 1, [2], [1])
    tn.self_trace(0, 2, [1], [0])

    tn_wep = tn.stabilizer_enumerator_polynomial(verbose=True)

    assert total_wep == tn_wep

    ################ NODE 3 ###################

    t3 = (
        StabilizerCodeTensorEnumerator(enc_tens_512, idx=3)
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

    brute_force_wep = h_pte.scalar_stabilizer_enumerator()
    print(brute_force_wep)

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

    assert brute_force_wep == dict(total_wep._dict)

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
        StabilizerCodeTensorEnumerator(enc_tens_422, idx=0)
        .trace_with_stopper(PAULI_I, 4)
        .trace_with_stopper(PAULI_I, 5),
        StabilizerCodeTensorEnumerator(enc_tens_422, idx=1)
        .trace_with_stopper(PAULI_I, 4)
        .trace_with_stopper(PAULI_I, 5),
    ]

    tn = TensorNetwork(nodes)
    tn.self_trace(0, 1, [1], [2])
    tn.self_trace(0, 1, [2], [1])

    wep = tn.stabilizer_enumerator()
    print(wep)

    assert wep == {4: 3, 0: 1}


def test_construction_code():
    # Add the parent directory to Python path to find qlego package
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    tn = SurfaceCodeTN(3)
    code = tn.construction_code()

    print(code)

    # Split the code into imports and construction
    code_lines = code.split("\n")

    construction_lines = [
        line
        for line in code_lines
        if not (line.startswith("from") or line.startswith("import"))
    ]

    # Create a namespace with required imports
    namespace = {
        "GF2": GF2,
        "TensorNetwork": TensorNetwork,
        "StabilizerCodeTensorEnumerator": StabilizerCodeTensorEnumerator,
    }

    # Execute construction code in the namespace
    exec("\n".join(construction_lines), namespace)
    tn_from_code = namespace["tn"]

    assert tn_from_code == tn


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
            idx="encoding_tensor_512-1741469569037-dtap10r8u",
        )
    )
    nodes["stopper_x-1741469771579-66rik1482"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469771579-66rik1482",
    )
    nodes["stopper_z-1741469873935-7x8lepkz0"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469873935-7x8lepkz0",
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
            idx="encoding_tensor_512-1741469573383-vywzti2i7",
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
            idx="encoding_tensor_512-1741469806847-zh6tym4ir",
        )
    )
    nodes["stopper_x-1741469775700-mqqxo9prq"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469775700-mqqxo9prq",
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
            idx="encoding_tensor_512-1741469792957-3buy4eynz",
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
            idx="encoding_tensor_512-1741469808602-uoj183v5a",
        )
    )
    nodes["stopper_z-1741469888356-0g4nnrhvn"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469888356-0g4nnrhvn",
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
            idx="encoding_tensor_512-1741469811429-2iso8lzh2",
        )
    )
    nodes["stopper_x-1741469797022-mxbutnmk4"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469797022-mxbutnmk4",
    )
    nodes["stopper_z-1741469886390-bi1budt2m"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469886390-bi1budt2m",
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
            idx="encoding_tensor_512-1741469809666-boitky627",
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
            idx="encoding_tensor_512-1741469812426-63xr66brk",
        )
    )
    nodes["stopper_x-1741469821306-v1lj0052l"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469821306-v1lj0052l",
    )
    nodes["stopper_z-1741469890980-mrvl1054y"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469890980-mrvl1054y",
    )
    nodes["stopper_z-1741469892323-ur5jgaa88"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469892323-ur5jgaa88",
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
            idx="encoding_tensor_512-1741469813386-3cidseuj5",
        )
    )
    nodes["stopper_x-1741469823864-5miztfum6"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469823864-5miztfum6",
    )
    nodes["stopper_x-1741469826392-9ruhud11d"] = StabilizerCodeTensorEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469826392-9ruhud11d",
    )
    nodes["stopper_z-1741469893043-9dwerhtds"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469893043-9dwerhtds",
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
    assert we._dict == {8: 129, 6: 100, 4: 22, 2: 4, 0: 1}


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
        idx="0",
    )
    nodes["stop1"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 0]]),
        idx="stop1",
    )
    nodes["stop2"] = StabilizerCodeTensorEnumerator(
        h=GF2([[0, 0]]),
        idx="stop2",
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
        verbose=True, progress_bar=True
    )._dict == {0: 1, 4: 3}


def test_tensor_product_of_legos():
    tn = TensorNetwork(
        [
            StabilizerCodeTensorEnumerator(idx=0, h=Legos.enconding_tensor_512),
            StabilizerCodeTensorEnumerator(idx=1, h=Legos.enconding_tensor_512),
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
        idx="1",
    )
    nodes["34"] = StabilizerCodeTensorEnumerator(
        # fmt: off
        h=GF2([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1], [0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1], [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]),
        # fmt: on
        idx="34",
    )

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=None)

    # Add traces
    tn.self_trace("1", "34", [3], [13])
    tn.self_trace("1", "34", [0], [4])
    tn.self_trace("1", "34", [1], [0])
    tn.self_trace("1", "34", [2], [11])

    poly = tn.stabilizer_enumerator_polynomial(
        verbose=True, progress_bar=True, cotengra=False
    )

    assert poly[0] == 1


def test_quadruple_trace_422_into_422():
    nodes = {}
    nodes["18"] = StabilizerCodeTensorEnumerator(
        h=Legos.enconding_tensor_512,
        idx="18",
    )
    nodes["19"] = StabilizerCodeTensorEnumerator(
        h=Legos.enconding_tensor_512,
        idx="19",
    )

    # Create TensorNetwork
    tn = TensorNetwork(nodes, truncate_length=None)

    # Add traces
    tn.self_trace("18", "19", [0], [0])
    tn.self_trace("18", "19", [1], [1])
    tn.self_trace("18", "19", [2], [2])
    tn.self_trace("18", "19", [3], [3])

    # tn.conjoin_nodes(verbose=True, progress_bar=True)

    assert tn.stabilizer_enumerator_polynomial(
        verbose=True,
        progress_bar=True,
    )._dict == {0: 1, 2: 3}


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
                idx="0",
            ),
            "1": StabilizerCodeTensorEnumerator(
                h=GF2(
                    [
                        [1, 1, 0, 0],
                        [0, 0, 1, 1],
                    ]
                ),
                idx="1",
            ),
        }
    )
    assert tn.stabilizer_enumerator_polynomial(
        verbose=True,
        progress_bar=True,
    )._dict == {0: 1, 2: 6, 4: 9}


def test_two_512_tensor_merge_step_by_step():
    nodes = {}
    nodes["1"] = StabilizerCodeTensorEnumerator(
        h=Legos.enconding_tensor_512,
        idx="1",
    )
    nodes["2"] = StabilizerCodeTensorEnumerator(
        h=Legos.enconding_tensor_512,
        idx="2",
    )

    # Create TensorNetwork

    traces = [
        ("1", "2", [0], [0]),
        ("1", "2", [1], [1]),
        ("1", "2", [2], [2]),
        ("1", "2", [3], [3]),
    ]

    for i in range(len(traces) + 1):
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
            progress_bar=True,
            open_legs=open_legs,
        )
        conjoined_wep_str = (
            str(conjoined_wep)
            if isinstance(conjoined_wep, SimplePoly)
            else "\n".join(
                sorted([f"{sstr(GF2([k]))}: {v}" for k, v in conjoined_wep.items()])
            )
        )
        print("============== TN WEP ================================")
        tn_wep = tn.stabilizer_enumerator_polynomial(
            verbose=True,
            progress_bar=True,
            open_legs=open_legs,
        )
        tn_wep_str = (
            str(tn_wep)
            if isinstance(tn_wep, SimplePoly)
            else "\n".join(
                sorted([f"{sstr(GF2([k]))}: {v}" for k, v in tn_wep.items()])
            )
        )
        with open(f"step_{i}_wep.txt", "w") as f:
            f.write(f"{tn_wep_str}")
        with open(f"step_{i}_conj_wep.txt", "w") as f:
            f.write(f"{conjoined_wep_str}")

        assert (
            tn_wep_str == conjoined_wep_str
        ), f"step {i} failed. tnwep:\n{tn_wep_str}\nconj_wep:\n{conjoined_wep_str}"
