from copy import deepcopy
import sys
from galois import GF2
import numpy as np
import pytest
import scipy
import sympy

from legos import Legos
from linalg import gauss
from parity_check import conjoin, sprint
from scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from symplectic import weight
from tensor_stabilizer_enumerator import (
    PAULI_X,
    PAULI_Y,
    PAULI_Z,
    SimplePoly,
    TensorNetwork,
    TensorStabilizerCodeEnumerator,
    sconcat,
    sslice,
)

from sympy.abc import w, z
from sympy import Poly


def test_422_logical_legs_enumerator():
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

    tensorwe_on_log_legs = TensorStabilizerCodeEnumerator(enc_tens_422)

    assert {4: 3, 0: 1} == tensorwe_on_log_legs.stabilizer_enumerator(
        [4, 5], e=GF2.Zeros(4), eprime=GF2.Zeros(4)
    )


def test_422_physical_legs_off_diagonlas():
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
    vec_enum_phys_legs = TensorStabilizerCodeEnumerator(enc_tens_422)
    assert {0: 2} == vec_enum_phys_legs.stabilizer_enumerator(
        traced_legs=[0, 1, 2, 3], e=GF2([1, 1, 1, 1, 0, 0, 0, 0]), eprime=GF2.Zeros(8)
    )


def test_steane_logical_legs():
    steane_tensor = GF2(
        [
            # fmt: off
            [1, 0, 0, 1, 1, 0, 0, 1,   0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0,   1, 1, 0, 0, 1, 1, 0, 0],
            [1, 1, 1, 1, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0,   1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1,   0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0,   1, 0, 0, 1, 1, 0, 0, 1],
            [1, 1, 0, 0, 1, 1, 0, 0,   0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 1, 1, 1, 1],
            # fmt: on
        ]
    )
    tensorwe_on_log_legs = TensorStabilizerCodeEnumerator(steane_tensor)

    h = GF2(
        [
            [1, 0, 1, 0, 1, 0, 1],
            [0, 1, 1, 0, 0, 1, 1],
            [0, 0, 0, 1, 1, 1, 1],
        ]
    )

    steane_parity = GF2(scipy.linalg.block_diag(h, h))

    we = ScalarStabilizerCodeEnumerator(steane_parity).stabilizer_enumerator()

    assert we == tensorwe_on_log_legs.stabilizer_enumerator(
        traced_legs=[0], e=GF2.Zeros(2), eprime=GF2.Zeros(2)
    )


def test_trace_two_422_codes_into_steane():
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

    t1 = TensorStabilizerCodeEnumerator(enc_tens_422, idx=1)
    t2 = TensorStabilizerCodeEnumerator(enc_tens_422, idx=2)

    # we join the two tensors via the tracked legs (4,4)
    t3 = t2.conjoin(t1, [4, 5], [4, 5])

    steane = GF2(
        [
            # fmt: off
            [1, 0, 0, 1, 1, 0, 0, 1,   0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0,   1, 1, 0, 0, 1, 1, 0, 0],            
            [0, 0, 0, 0, 1, 1, 1, 1,   0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 1, 1, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0,   1, 1, 1, 1, 0, 0, 0, 0],            
            [0, 0, 0, 0, 0, 0, 0, 0,   1, 0, 0, 1, 1, 0, 0, 1],
            [1, 1, 1, 1, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 1, 1, 0, 0,   0, 0, 0, 0, 0, 0, 0, 0],
            # fmt: on
        ]
    )

    assert (
        ScalarStabilizerCodeEnumerator(steane).stabilizer_enumerator_polynomial()
        == ScalarStabilizerCodeEnumerator(t3.h).stabilizer_enumerator_polynomial()
    )

    assert {6: 42, 4: 21, 0: 1} == t3.stabilizer_enumerator(
        traced_legs=[0], e=GF2.Zeros(2), eprime=GF2.Zeros(2)
    )


def test_trace_two_422_codes_into_steane_v2():
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

    t1 = TensorStabilizerCodeEnumerator(enc_tens_422, idx=0)
    t2 = TensorStabilizerCodeEnumerator(enc_tens_422, idx=1)

    tn = TensorNetwork(nodes=[t1, t2])
    tn.self_trace(0, 1, [4], [4])
    tn.self_trace(0, 1, [5], [5])

    assert {6: 42, 4: 21, 0: 1} == tn.stabilizer_enumerator_polynomial(
        verbose=True, legs=[(0, 0)], e=GF2.Zeros(2), eprime=GF2.Zeros(2)
    )._dict


def test_stopper_tensors():
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

    node = TensorStabilizerCodeEnumerator(enc_tens_422)
    node = node.trace_with_stopper(stopper=PAULI_Z, traced_leg=3)

    assert np.array_equal(
        node.h,
        GF2(
            [
                # 0  1  2  4  5  0  1  2  4  5
                [0, 0, 0, 0, 0, 1, 1, 1, 0, 0],
                # X1
                [1, 1, 0, 1, 0, 0, 0, 0, 0, 0],
                # X2
                [0, 1, 1, 0, 1, 0, 0, 0, 0, 0],
                # Z2
                [0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
                # Z1
                [0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
            ]
        ),
    ), f"Not equal: \n{repr(node.h)}"

    assert node.legs == [(0, 0), (0, 1), (0, 2), (0, 4), (0, 5)]

    with pytest.raises(ValueError):
        node.trace_with_stopper(stopper=GF2([0, 1]), traced_leg=3)

    node = node.trace_with_stopper(stopper=PAULI_X, traced_leg=0)

    assert np.array_equal(
        node.h,
        GF2(
            [
                # 1  2  4  5  1  2  4  5
                # X1
                [1, 0, 1, 0, 0, 0, 0, 0],
                # X2
                [1, 1, 0, 1, 0, 0, 0, 0],
                # Z2
                [0, 0, 0, 0, 0, 1, 0, 1],
                # Z1
                [0, 0, 0, 0, 1, 1, 1, 0],
            ]
        ),
    ), f"Not equal: \n{repr(node.h)}"


def test_open_legged_enumerator():
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

    t1 = TensorStabilizerCodeEnumerator(enc_tens_422, idx=5)

    t2 = t1.stabilizer_enumerator_polynomial([4, 5], open_legs=[0, 1])

    assert t2 == {
        (0, 0, 0, 0): SimplePoly({0: 1}),
        (0, 0, 1, 1): SimplePoly({2: 1}),
        (1, 1, 0, 0): SimplePoly({2: 1}),
        (1, 1, 1, 1): SimplePoly({2: 1}),
    }, f"not equal:\n{t2}"


def test_stoppers_in_different_order():
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
    t1 = TensorStabilizerCodeEnumerator(enc_tens_512, idx=1).trace_with_stopper(
        PAULI_Z, 0
    )
    assert np.array_equal(
        t1.h,
        GF2(
            [
                # fmt: off
    [0,0,0, 0,  1,1,1,  0,], 
    # X1
    [0,1,1, 1,  0,0,0,  0,],        
    # Z1
    [0,0,0, 0,  1,1,0,  1,],
                # fmt: on
            ]
        ),
    )

    t1 = t1.trace_with_stopper(PAULI_X, 3)

    assert np.array_equal(
        t1.h,
        GF2(
            [
                # fmt: off
    [0,1, 1,  0,0,  0,],              
    [0,0, 0,  1,1,  1,],
                # fmt: on
            ]
        ),
    )


def test_step_by_step_to_d2_surface_code():
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
        TensorStabilizerCodeEnumerator(enc_tens_512, idx=0)
        .trace_with_stopper(PAULI_Z, 3)
        .trace_with_stopper(PAULI_X, 0)
    )

    t1 = (
        TensorStabilizerCodeEnumerator(enc_tens_512, idx=1)
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

    brute_force_wep = h_pte.stabilizer_enumerator()
    print(brute_force_wep)

    ### Checking PartiallyTracedEnumerator equivalence

    pte = t0.trace_with(
        t1,
        join_legs1=[2],
        join_legs2=[1],
        traced_legs1=[],
        traced_legs2=[],
        e1=GF2([]),
        eprime1=GF2([]),
        e2=GF2([]),
        eprime2=GF2([]),
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
        TensorStabilizerCodeEnumerator(enc_tens_512, idx=2)
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

    brute_force_wep = h_pte.stabilizer_enumerator()
    print(brute_force_wep)

    ### Checking PartiallyTracedEnumerator equivalence

    pte = pte.trace_with(
        t2,
        join_legs1=[(0, 1)],
        join_legs2=[0],
        traced_legs=[],
        e=GF2([]),
        eprime=GF2([]),
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
        TensorStabilizerCodeEnumerator(enc_tens_512, idx=3)
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

    brute_force_wep = h_pte.stabilizer_enumerator()
    print(brute_force_wep)

    ### Checking PartiallyTracedEnumerator equivalence

    pte = pte.trace_with(
        t3,
        join_legs1=[(2, 3), (1, 2)],
        join_legs2=[0, 3],
        traced_legs=[],
        e=GF2([]),
        eprime=GF2([]),
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


def test_d3_rsc_with_merged_ptes():
    tn = TensorNetwork.make_rsc(d=3)
    tn_single_pte = TensorNetwork.make_rsc(d=3)

    print(tn.traces)
    tn.traces = [
        (0, 1, [(0, 2)], [(1, 1)]),
        (0, 3, [(0, 1)], [(3, 0)]),
        (7, 8, [(7, 3)], [(8, 0)]),
        (5, 8, [(5, 2)], [(8, 3)]),
        (3, 4, [(3, 3)], [(4, 0)]),
        (1, 4, [(1, 2)], [(4, 3)]),
        (1, 2, [(1, 3)], [(2, 0)]),
        (3, 6, [(3, 2)], [(6, 3)]),
        (4, 5, [(4, 2)], [(5, 1)]),
        (2, 5, [(2, 1)], [(5, 0)]),
        (4, 7, [(4, 1)], [(7, 0)]),
        (6, 7, [(6, 2)], [(7, 1)]),
    ]

    assert (
        tn.stabilizer_enumerator_polynomial(verbose=True)
        == tn_single_pte.stabilizer_enumerator_polynomial()
    )


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
        TensorStabilizerCodeEnumerator(enc_tens_422, idx=0),
        TensorStabilizerCodeEnumerator(enc_tens_422, idx=1),
    ]

    tn = TensorNetwork(nodes)
    tn.self_trace(0, 1, [1], [2])
    tn.self_trace(0, 1, [2], [1])

    wep = tn.stabilizer_enumerator(0, [(0, 4), (0, 5), (1, 4), (1, 5)])
    print(wep)

    assert wep == {4: 3, 0: 1}


def test_d3_rotated_surface_code():
    # pytest.skip()
    rsc = GF2(
        [
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
        ]
    )

    scalar = ScalarStabilizerCodeEnumerator(rsc)
    print(scalar.stabilizer_enumerator)

    tn = TensorNetwork.make_rsc(d=3)

    we = tn.stabilizer_enumerator_polynomial()
    assert we._dict == {8: 129, 6: 100, 4: 22, 2: 4, 0: 1}


def test_d3_creation():
    tn = TensorNetwork.make_rsc(3)

    nodes = [
        TensorStabilizerCodeEnumerator(Legos.econding_tensor_512, idx=i)
        for i in range(9)
    ]

    # top Z boundary
    nodes[0] = nodes[0].trace_with_stopper(PAULI_Z, 3)
    nodes[1] = nodes[1].trace_with_stopper(PAULI_Z, 0)
    nodes[2] = nodes[2].trace_with_stopper(PAULI_Z, 3)

    # bottom Z boundary
    nodes[6] = nodes[6].trace_with_stopper(PAULI_Z, 1)
    nodes[7] = nodes[7].trace_with_stopper(PAULI_Z, 2)
    nodes[8] = nodes[8].trace_with_stopper(PAULI_Z, 1)

    # left X boundary
    nodes[0] = nodes[0].trace_with_stopper(PAULI_X, 0)
    nodes[3] = nodes[3].trace_with_stopper(PAULI_X, 1)
    nodes[6] = nodes[6].trace_with_stopper(PAULI_X, 0)

    # right X boundary
    nodes[2] = nodes[2].trace_with_stopper(PAULI_X, 2)
    nodes[5] = nodes[5].trace_with_stopper(PAULI_X, 3)
    nodes[8] = nodes[8].trace_with_stopper(PAULI_X, 2)

    for i, node in tn.nodes.items():
        assert node.idx == i
        print(node.h)
        print(nodes[i].h)
        assert np.array_equal(
            node.h, nodes[i].h
        ), f"Parities don't match at node {i},\n{node.h}\n{nodes[i].h}"

    assert tn.traces == [
        (0, 1, [(0, 2)], [(1, 1)]),
        (0, 3, [(0, 1)], [(3, 0)]),
        (3, 4, [(3, 3)], [(4, 0)]),
        (1, 4, [(1, 2)], [(4, 3)]),
        (1, 2, [(1, 3)], [(2, 0)]),
        (3, 6, [(3, 2)], [(6, 3)]),
        (4, 5, [(4, 2)], [(5, 1)]),
        (2, 5, [(2, 1)], [(5, 0)]),
        (4, 7, [(4, 1)], [(7, 0)]),
        (6, 7, [(6, 2)], [(7, 1)]),
        (7, 8, [(7, 3)], [(8, 0)]),
        (5, 8, [(5, 2)], [(8, 3)]),
    ], f"Traces are not equal, got:\n{'\n'.join(str(tr)for tr in tn.traces)}"

    assert tn.legs_left_to_join == {
        0: [(0, 2), (0, 1)],
        1: [(1, 1), (1, 2), (1, 3)],
        2: [(2, 0), (2, 1)],
        3: [(3, 0), (3, 3), (3, 2)],
        4: [(4, 0), (4, 3), (4, 2), (4, 1)],
        5: [(5, 1), (5, 0), (5, 2)],
        6: [(6, 3), (6, 2)],
        7: [(7, 0), (7, 1), (7, 3)],
        8: [(8, 0), (8, 3)],
    }


assert {
    0: [(0, 2), (0, 1)],
    1: [(1, 1), (1, 2), (1, 3)],
    2: [(2, 0), (2, 1)],
    3: [(3, 0), (3, 3), (3, 2)],
    4: [(4, 0), (4, 3), (4, 2), (4, 1)],
    5: [(5, 1), (5, 0), (5, 2)],
    6: [(6, 3), (6, 2)],
    7: [(7, 0), (7, 1), (7, 3)],
    8: [(8, 0), (8, 3)],
}, f"Legs to trace are not equal, got:\n{tn.legs_left_to_join}"


def test_d5_rotated_surface_code():
    # pytest.skip()
    rsc5_enum = (
        SimplePoly(
            {
                0: 4,
                4: 288,
                8: 14860,
                6: 2136,
                10: 103264,
                2: 32,
                12: 633792,
                14: 3130128,
                16: 10904188,
                18: 20461504,
                20: 20546528,
                22: 9748824,
                24: 1563316,
            }
        )
        / 4
    )
    print(rsc5_enum)
    tn = TensorNetwork.make_rsc(d=5)

    we = tn.stabilizer_enumerator_polynomial(
        summed_legs=[(idx, 4) for idx in tn.nodes.keys()], cotengra=False
    )
    assert we == rsc5_enum


def test_d5_rotated_surface_code_x_only():
    tn = TensorNetwork.make_rsc(d=5, lego=lambda i: Legos.econding_tensor_512_x)
    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert we == SimplePoly(
        {
            12: 1154,
            14: 937,
            10: 869,
            16: 525,
            8: 262,
            18: 191,
            6: 79,
            20: 52,
            4: 22,
            2: 4,
            0: 1,
        }
    )


def test_d2_unrotated_surface_code_with_summed_legs():
    tn = TensorNetwork.make_surface_code(d=2, lego=lambda i: Legos.econding_tensor_512)
    we = tn.stabilizer_enumerator_polynomial()

    tn2 = TensorNetwork.make_surface_code(d=2, lego=lambda i: Legos.econding_tensor_512)
    expected_we = tn2.stabilizer_enumerator_polynomial(
        summed_legs=[(idx, 4) for idx in tn.nodes.keys()]
    )

    assert we == expected_we, f"Not equal, got:\n{we}, expected\n{expected_we}"


def test_d2_unrotated_surface_code():
    tn = TensorNetwork.make_surface_code(d=2, lego=lambda i: Legos.econding_tensor_512)
    we = tn.stabilizer_enumerator_polynomial()

    h = GF2(
        [
            [1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]
    )

    expected_we = (
        ScalarStabilizerCodeEnumerator(h).stabilizer_enumerator_polynomial() / 4
    )

    assert we == expected_we, f"Not equal, got:\n{we}, expected\n{expected_we}"


def test_d3_unrotated_surface_code():
    tn = TensorNetwork.make_surface_code(d=3, lego=lambda i: Legos.econding_tensor_512)
    we = tn.stabilizer_enumerator_polynomial()

    hx_sparse = [
        [0, 1, 3],
        [1, 2, 4],
        [3, 5, 6, 8],
        [4, 6, 7, 9],
        [8, 10, 11],
        [9, 11, 12],
    ]

    hz_sparse = [
        [0, 3, 5],
        [1, 3, 4, 6],
        [2, 4, 7],
        [5, 8, 10],
        [6, 8, 9, 11],
        [7, 9, 12],
    ]

    hz = GF2.Zeros((6, 13))
    for r, g in enumerate(hz_sparse):
        hz[r][np.array(g)] = 1

    hx = GF2.Zeros((6, 13))
    for r, g in enumerate(hx_sparse):
        hx[r][np.array(g)] = 1

    h = GF2(scipy.linalg.block_diag(hx, hz))

    expected_we = (
        ScalarStabilizerCodeEnumerator(h).stabilizer_enumerator_polynomial() / 4
    )

    assert we == expected_we, f"WEPs not equal\ngot:\n{we},\nexpected\n{expected_we}"


def test_compass_code():
    tn = TensorNetwork.make_compass_sq(
        [
            [1, 1],
            [2, 1],
        ]
    )

    tn_wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    expected_wep = (
        ScalarStabilizerCodeEnumerator(
            GF2(
                [
                    [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
                ]
            )
        ).stabilizer_enumerator_polynomial()
        / 4
    )

    assert tn_wep == expected_wep


def test_tanner_graph_enumerator():
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

    tn = TensorNetwork.from_css_parity_check_matrix(hx, hz)

    wep = tn.stabilizer_enumerator_polynomial(verbose=True)
    tn = TensorNetwork.make_compass_sq(
        [
            [1, 1],
            [2, 1],
        ]
    )

    expected_wep = tn.stabilizer_enumerator_polynomial()

    assert wep == expected_wep


def test_compass_code_z_coset_weight_enumerator_weight1():
    coloring = np.array(
        [
            [1, 2],
            [2, 1],
        ]
    )
    tn = TensorNetwork.make_compass_sq(
        coloring,
        lego=lambda i: Legos.econding_tensor_512_z,
        coset_error=GF2([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]),
    )
    wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert wep == SimplePoly({5: 9, 3: 4, 7: 2, 1: 1}), f"Not equal, got:\n{wep}"


def test_compass_code_z_coset_weight_enumerator_weight2():
    coloring = np.array(
        [
            [1, 2],
            [2, 1],
        ]
    )
    tn = TensorNetwork.make_compass_sq(
        coloring,
        lego=lambda i: Legos.econding_tensor_512_z,
        coset_error=GF2([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1]),
    )
    wep = tn.stabilizer_enumerator_polynomial(cotengra=False)
    assert wep == SimplePoly({4: 10, 6: 5, 2: 1}), f"Not equal, got:\n{wep}"


def test_rsc3_x_and_z_coset_wep():
    rsc = GF2(
        [
            [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1],
        ]
    )

    x_error_bits = [0, 2]
    z_error_bits = [1, 2]

    scalar = TensorStabilizerCodeEnumerator(
        rsc,
        coset_flipped_legs=[
            ((0, q), PAULI_X) for q in x_error_bits if q not in z_error_bits
        ]
        + [((0, q), PAULI_Z) for q in z_error_bits if q not in x_error_bits]
        + [
            ((0, q), PAULI_Y) for q in set(x_error_bits).intersection(set(z_error_bits))
        ],
    )
    print(scalar.stabilizer_enumerator())

    coset_error = GF2.Zeros(18)
    for b in x_error_bits:
        coset_error[b] = 1
    for b in z_error_bits:
        coset_error[b + 9] = 1
    tn = TensorNetwork.make_rsc(
        d=3,
        coset_error=coset_error,
    )

    we = tn.stabilizer_enumerator_polynomial(cotengra=False)
    print("----")
    assert we == scalar.stabilizer_enumerator_polynomial()


def test_d3_unrotated_surface_code_coset_weight_enumerator():

    x_error_bits = [0, 2, 3, 7]
    z_error_bits = [1, 2, 7, 9]

    coset_error = GF2.Zeros(2 * 13)
    for b in x_error_bits:
        coset_error[b] = 1
    for b in z_error_bits:
        coset_error[b + 13] = 1

    tn = TensorNetwork.make_surface_code(
        d=3, lego=lambda i: Legos.econding_tensor_512, coset_error=coset_error
    )
    we = tn.stabilizer_enumerator_polynomial(cotengra=False)

    hx_sparse = [
        [0, 1, 3],
        [1, 2, 4],
        [3, 5, 6, 8],
        [4, 6, 7, 9],
        [8, 10, 11],
        [9, 11, 12],
    ]

    hz_sparse = [
        [0, 3, 5],
        [1, 3, 4, 6],
        [2, 4, 7],
        [5, 8, 10],
        [6, 8, 9, 11],
        [7, 9, 12],
    ]

    hz = GF2.Zeros((6, 13))

    for r, g in enumerate(hz_sparse):
        hz[r][np.array(g)] = 1

    hx = GF2.Zeros((6, 13))
    for r, g in enumerate(hx_sparse):
        hx[r][np.array(g)] = 1

    h = GF2(scipy.linalg.block_diag(hx, hz))

    # x_errors = [
    #     (0, 0),
    #     (0, 4),
    #     (2, 4),
    #     (1, 1),
    # ]
    # z_errors = [
    #     (0, 2),
    #     (0, 4),
    #     (0, 4),
    #     (2, 4),
    #     (2, 4),
    #     (3, 3),
    # ]

    print("----")
    expected_we = TensorStabilizerCodeEnumerator(
        h,
        coset_flipped_legs=[
            ((0, q), PAULI_X) for q in x_error_bits if q not in z_error_bits
        ]
        + [((0, q), PAULI_Z) for q in z_error_bits if q not in x_error_bits]
        + [
            ((0, q), PAULI_Y) for q in set(x_error_bits).intersection(set(z_error_bits))
        ],
    ).stabilizer_enumerator_polynomial()
    assert we == expected_we, f"WEPs not equal\ngot:\n{we},\nexpected\n{expected_we}"
