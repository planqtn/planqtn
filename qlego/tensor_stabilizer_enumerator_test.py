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
from qlego.parity_check import conjoin, sprint
from qlego.scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator
from qlego.symplectic import weight
from qlego.tensor_stabilizer_enumerator import (
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
        gauss(node.h),
        gauss(
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
            )
        ),
    ), f"Not equal: \n{repr(node.h)}"

    assert node.legs == [(0, 0), (0, 1), (0, 2), (0, 4), (0, 5)]

    with pytest.raises(ValueError):
        node.trace_with_stopper(stopper=GF2([0, 1]), traced_leg=3)

    node = node.trace_with_stopper(stopper=PAULI_X, traced_leg=0)

    assert np.array_equal(
        gauss(node.h),
        gauss(
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
            )
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
        gauss(t1.h),
        gauss(
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
            )
        ),
    )

    t1 = t1.trace_with_stopper(PAULI_X, 3)

    assert np.array_equal(
        gauss(t1.h),
        gauss(
            GF2(
                [
                    # fmt: off
    [0,1, 1,  0,0,  0,],              
    [0,0, 0,  1,1,  1,],
                    # fmt: on
                ]
            )
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
        "TensorStabilizerCodeEnumerator": TensorStabilizerCodeEnumerator,
    }

    # Execute construction code in the namespace
    exec("\n".join(construction_lines), namespace)
    tn_from_code = namespace["tn"]

    assert tn_from_code == tn


def test_disjoint_nodes():

    nodes = {}
    nodes["encoding_tensor_512-1741469569037-dtap10r8u"] = (
        TensorStabilizerCodeEnumerator(
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
    nodes["stopper_x-1741469771579-66rik1482"] = TensorStabilizerCodeEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469771579-66rik1482",
    )
    nodes["stopper_z-1741469873935-7x8lepkz0"] = TensorStabilizerCodeEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469873935-7x8lepkz0",
    )
    nodes["encoding_tensor_512-1741469573383-vywzti2i7"] = (
        TensorStabilizerCodeEnumerator(
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
        TensorStabilizerCodeEnumerator(
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
    nodes["stopper_x-1741469775700-mqqxo9prq"] = TensorStabilizerCodeEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469775700-mqqxo9prq",
    )
    nodes["encoding_tensor_512-1741469792957-3buy4eynz"] = (
        TensorStabilizerCodeEnumerator(
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
        TensorStabilizerCodeEnumerator(
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
    nodes["stopper_z-1741469888356-0g4nnrhvn"] = TensorStabilizerCodeEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469888356-0g4nnrhvn",
    )
    nodes["encoding_tensor_512-1741469811429-2iso8lzh2"] = (
        TensorStabilizerCodeEnumerator(
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
    nodes["stopper_x-1741469797022-mxbutnmk4"] = TensorStabilizerCodeEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469797022-mxbutnmk4",
    )
    nodes["stopper_z-1741469886390-bi1budt2m"] = TensorStabilizerCodeEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469886390-bi1budt2m",
    )
    nodes["encoding_tensor_512-1741469809666-boitky627"] = (
        TensorStabilizerCodeEnumerator(
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
        TensorStabilizerCodeEnumerator(
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
    nodes["stopper_x-1741469821306-v1lj0052l"] = TensorStabilizerCodeEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469821306-v1lj0052l",
    )
    nodes["stopper_z-1741469890980-mrvl1054y"] = TensorStabilizerCodeEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469890980-mrvl1054y",
    )
    nodes["stopper_z-1741469892323-ur5jgaa88"] = TensorStabilizerCodeEnumerator(
        h=GF2([[0, 1]]),
        idx="stopper_z-1741469892323-ur5jgaa88",
    )
    nodes["encoding_tensor_512-1741469813386-3cidseuj5"] = (
        TensorStabilizerCodeEnumerator(
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
    nodes["stopper_x-1741469823864-5miztfum6"] = TensorStabilizerCodeEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469823864-5miztfum6",
    )
    nodes["stopper_x-1741469826392-9ruhud11d"] = TensorStabilizerCodeEnumerator(
        h=GF2([[1, 0]]),
        idx="stopper_x-1741469826392-9ruhud11d",
    )
    nodes["stopper_z-1741469893043-9dwerhtds"] = TensorStabilizerCodeEnumerator(
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

    node = tn.conjoin_nodes()
    assert node.h.shape == (8, 18)

    we = node.stabilizer_enumerator_polynomial()
    assert we._dict == {8: 129, 6: 100, 4: 22, 2: 4, 0: 1}
