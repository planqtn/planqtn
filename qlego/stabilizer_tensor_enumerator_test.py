from galois import GF2
import scipy.linalg
import numpy as np
import pytest
from qlego.legos import Legos
from qlego.linalg import gauss
from qlego.simple_poly import SimplePoly
from qlego.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from qlego.tensor_network import PAULI_I, PAULI_X, PAULI_Z


@pytest.mark.parametrize(
    "h,expected_wep",
    [
        (GF2([PAULI_I]), {0: 1}),
        (GF2([PAULI_X]), {0: 1, 1: 1}),
        (GF2([PAULI_Z]), {0: 1, 1: 1}),
    ],
)
def test_stopper_weight_enumerators(h, expected_wep):
    te = StabilizerCodeTensorEnumerator(
        h=h,
        idx="stopper-test",
    )
    assert (
        te.stabilizer_enumerator_polynomial()._dict == expected_wep
    ), f"For {h}, expected {expected_wep}, got {te.stabilizer_enumerator_polynomial()._dict}"


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
    t1 = StabilizerCodeTensorEnumerator(enc_tens_512, idx=1).trace_with_stopper(
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

    t1 = (
        StabilizerCodeTensorEnumerator(enc_tens_422, idx=5)
        .trace_with_stopper(PAULI_I, 4)
        .trace_with_stopper(PAULI_I, 5)
    )

    t2 = t1.stabilizer_enumerator_polynomial(open_legs=[0, 1])

    assert t2 == {
        (0, 0, 0, 0): SimplePoly({0: 1}),
        (0, 0, 1, 1): SimplePoly({2: 1}),
        (1, 1, 0, 0): SimplePoly({2: 1}),
        (1, 1, 1, 1): SimplePoly({2: 1}),
    }, f"not equal:\n{t2}"


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

    node = StabilizerCodeTensorEnumerator(enc_tens_422)
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

    t1 = StabilizerCodeTensorEnumerator(enc_tens_422, idx=1)
    t2 = StabilizerCodeTensorEnumerator(enc_tens_422, idx=2)

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
        StabilizerCodeTensorEnumerator(steane).stabilizer_enumerator_polynomial()
        == StabilizerCodeTensorEnumerator(t3.h).stabilizer_enumerator_polynomial()
    )

    assert {6: 42, 4: 21, 0: 1} == t3.trace_with_stopper(
        PAULI_I, 0
    ).scalar_stabilizer_enumerator()


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
    tensorwe_on_log_legs = StabilizerCodeTensorEnumerator(
        steane_tensor
    ).trace_with_stopper(PAULI_I, 0)

    h = GF2(
        [
            [1, 0, 1, 0, 1, 0, 1],
            [0, 1, 1, 0, 0, 1, 1],
            [0, 0, 0, 1, 1, 1, 1],
        ]
    )

    steane_parity = GF2(scipy.linalg.block_diag(h, h))

    we = StabilizerCodeTensorEnumerator(steane_parity).scalar_stabilizer_enumerator()

    assert we == tensorwe_on_log_legs.scalar_stabilizer_enumerator()


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

    tensorwe_on_log_legs = (
        StabilizerCodeTensorEnumerator(enc_tens_422)
        .trace_with_stopper(PAULI_I, 4)
        .trace_with_stopper(PAULI_I, 5)
    )

    assert {4: 3, 0: 1} == tensorwe_on_log_legs.scalar_stabilizer_enumerator()


def test_conjoin_to_scalar():
    joint = StabilizerCodeTensorEnumerator(GF2([PAULI_X]), idx=0).conjoin(
        StabilizerCodeTensorEnumerator(GF2([PAULI_X]), idx=1), [0], [0]
    )
    wep = joint.scalar_stabilizer_enumerator()
    assert wep == {0: 1}

    assert np.array_equal(joint.h, GF2([[1]])), f"Not equal, got\n{joint.h}"

    joint = (
        StabilizerCodeTensorEnumerator(idx=0, h=GF2([[1, 1, 0, 0], [0, 0, 1, 1]]))
        .conjoin(
            StabilizerCodeTensorEnumerator(idx=1, h=GF2([PAULI_I])), [(0, 0)], [(1, 0)]
        )
        .conjoin(
            StabilizerCodeTensorEnumerator(idx=2, h=GF2([PAULI_I])), [(0, 1)], [(2, 0)]
        )
    )
    wep = joint.scalar_stabilizer_enumerator()

    assert wep == {0: 1}
    assert np.array_equal(joint.h, GF2([[1]])), f"Not equal, got\n{joint.h}"


def tensor_with_scalar():

    wep = (
        StabilizerCodeTensorEnumerator(GF2([PAULI_I]))
        .tensor_with(StabilizerCodeTensorEnumerator(GF2([[5]])))
        .scalar_stabilizer_enumerator()
    )

    assert wep == {0: 1}


@pytest.mark.parametrize(
    "truncate_length, expected_wep",
    [
        (None, {0: 1, 4: 42, 6: 168, 8: 45}),
        (1, {0: 1}),
        (2, {0: 1}),
        (3, {0: 1}),
        (4, {0: 1, 4: 42}),
        (7, {0: 1, 4: 42, 6: 168}),
        (8, {0: 1, 4: 42, 6: 168, 8: 45}),
        (9, {0: 1, 4: 42, 6: 168, 8: 45}),
    ],
)
def test_truncated_scalar_enumerator(truncate_length, expected_wep):
    h = Legos.steane_code_813_encoding_tensor
    te = StabilizerCodeTensorEnumerator(h)
    assert (
        te.stabilizer_enumerator_polynomial(truncate_length=truncate_length)._dict
        == expected_wep
    )


@pytest.mark.parametrize(
    "truncate_length, expected_wep",
    [
        (
            None,
            {
                (0, 0): SimplePoly({0: 1, 4: 21, 6: 42}),
                (1, 0): SimplePoly({3: 7, 5: 42, 7: 15}),
                (1, 1): SimplePoly({3: 7, 5: 42, 7: 15}),
                (0, 1): SimplePoly({3: 7, 5: 42, 7: 15}),
            },
        ),
        (
            1,
            {
                (0, 0): SimplePoly({0: 1}),
            },
        ),
        (
            3,
            {
                (0, 0): SimplePoly({0: 1}),
                (1, 0): SimplePoly({3: 7}),
                (1, 1): SimplePoly({3: 7}),
                (0, 1): SimplePoly({3: 7}),
            },
        ),
        (
            4,
            {
                (0, 0): SimplePoly({0: 1, 4: 21}),
                (1, 0): SimplePoly({3: 7}),
                (1, 1): SimplePoly({3: 7}),
                (0, 1): SimplePoly({3: 7}),
            },
        ),
        (
            5,
            {
                (0, 0): SimplePoly({0: 1, 4: 21}),
                (1, 0): SimplePoly({3: 7, 5: 42}),
                (1, 1): SimplePoly({3: 7, 5: 42}),
                (0, 1): SimplePoly({3: 7, 5: 42}),
            },
        ),
        (
            7,
            {
                (0, 0): SimplePoly({0: 1, 4: 21, 6: 42}),
                (1, 0): SimplePoly({3: 7, 5: 42, 7: 15}),
                (1, 1): SimplePoly({3: 7, 5: 42, 7: 15}),
                (0, 1): SimplePoly({3: 7, 5: 42, 7: 15}),
            },
        ),
        (
            9,
            {
                (0, 0): SimplePoly({0: 1, 4: 21, 6: 42}),
                (1, 0): SimplePoly({3: 7, 5: 42, 7: 15}),
                (1, 1): SimplePoly({3: 7, 5: 42, 7: 15}),
                (0, 1): SimplePoly({3: 7, 5: 42, 7: 15}),
            },
        ),
    ],
)
def test_truncated_tensor_enumerator(truncate_length, expected_wep):
    h = Legos.steane_code_813_encoding_tensor
    te = StabilizerCodeTensorEnumerator(h)
    assert (
        te.stabilizer_enumerator_polynomial(
            open_legs=[7], truncate_length=truncate_length
        )
        == expected_wep
    )
