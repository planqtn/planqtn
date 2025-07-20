from galois import GF2
import scipy.linalg
import numpy as np
import pytest
from planqtn.legos import Legos
from planqtn.linalg import gauss
from planqtn.simple_poly import SimplePoly
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.tensor_network import PAULI_I, PAULI_X, PAULI_Z


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
        tensor_id="stopper-test",
    )
    assert (
        te.stabilizer_enumerator_polynomial().dict == expected_wep
    ), f"For {h}, expected {expected_wep}, got {te.stabilizer_enumerator_polynomial().dict}"


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
    t1 = StabilizerCodeTensorEnumerator(enc_tens_512, tensor_id=1).trace_with_stopper(
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
        StabilizerCodeTensorEnumerator(enc_tens_422, tensor_id=5)
        .trace_with_stopper(PAULI_I, 4)
        .trace_with_stopper(PAULI_I, 5)
    )

    t2 = t1.stabilizer_enumerator_polynomial(open_legs=[0, 1])

    assert t2 == {
        (0, 0): SimplePoly({0: 1}),
        (2, 2): SimplePoly({2: 1}),
        (1, 1): SimplePoly({2: 1}),
        (3, 3): SimplePoly({2: 1}),
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

    t1 = StabilizerCodeTensorEnumerator(enc_tens_422, tensor_id=1)
    t2 = StabilizerCodeTensorEnumerator(enc_tens_422, tensor_id=2)

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
    ).stabilizer_enumerator_polynomial().dict


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

    we = StabilizerCodeTensorEnumerator(
        steane_parity
    ).stabilizer_enumerator_polynomial()

    assert we == tensorwe_on_log_legs.stabilizer_enumerator_polynomial()


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

    assert {4: 3, 0: 1} == tensorwe_on_log_legs.stabilizer_enumerator_polynomial().dict


def test_conjoin_to_scalar():
    joint = StabilizerCodeTensorEnumerator(GF2([PAULI_X]), tensor_id=0).conjoin(
        StabilizerCodeTensorEnumerator(GF2([PAULI_X]), tensor_id=1), [0], [0]
    )
    wep = joint.stabilizer_enumerator_polynomial().dict
    assert wep == {0: 1}

    assert np.array_equal(joint.h, GF2([[1]])), f"Not equal, got\n{joint.h}"

    stopper_1 = StabilizerCodeTensorEnumerator(tensor_id=1, h=GF2([PAULI_I]))
    stopper_2 = StabilizerCodeTensorEnumerator(tensor_id=2, h=GF2([PAULI_I]))
    joint = (
        StabilizerCodeTensorEnumerator(
            tensor_id=0,
            h=GF2(
                [
                    [1, 1, 0, 0],
                    [0, 0, 1, 1],
                ]
            ),
        )
        .conjoin(stopper_1, [(0, 0)], [(1, 0)])
        .conjoin(stopper_2, [(0, 1)], [(2, 0)])
    )

    wep = joint.stabilizer_enumerator_polynomial().dict

    assert wep == {0: 1}
    assert np.array_equal(joint.h, GF2([[1]])), f"Not equal, got\n{joint.h}"


def tensor_with_scalar():

    wep = (
        StabilizerCodeTensorEnumerator(GF2([PAULI_I]))
        .tensor_with(StabilizerCodeTensorEnumerator(GF2([[5]])))
        .stabilizer_enumerator_polynomial()
        .dict
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
        te.stabilizer_enumerator_polynomial(truncate_length=truncate_length).dict
        == expected_wep
    )


@pytest.mark.parametrize(
    "truncate_length, expected_wep",
    [
        (
            None,
            {
                (0,): SimplePoly({0: 1, 4: 21, 6: 42}),
                (1,): SimplePoly({3: 7, 5: 42, 7: 15}),
                (3,): SimplePoly({3: 7, 5: 42, 7: 15}),
                (2,): SimplePoly({3: 7, 5: 42, 7: 15}),
            },
        ),
        (
            1,
            {
                (0,): SimplePoly({0: 1}),
            },
        ),
        (
            3,
            {
                (0,): SimplePoly({0: 1}),
                (1,): SimplePoly({3: 7}),
                (2,): SimplePoly({3: 7}),
                (3,): SimplePoly({3: 7}),
            },
        ),
        (
            4,
            {
                (0,): SimplePoly({0: 1, 4: 21}),
                (1,): SimplePoly({3: 7}),
                (2,): SimplePoly({3: 7}),
                (3,): SimplePoly({3: 7}),
            },
        ),
        (
            5,
            {
                (0,): SimplePoly({0: 1, 4: 21}),
                (1,): SimplePoly({3: 7, 5: 42}),
                (2,): SimplePoly({3: 7, 5: 42}),
                (3,): SimplePoly({3: 7, 5: 42}),
            },
        ),
        (
            7,
            {
                (0,): SimplePoly({0: 1, 4: 21, 6: 42}),
                (1,): SimplePoly({3: 7, 5: 42, 7: 15}),
                (2,): SimplePoly({3: 7, 5: 42, 7: 15}),
                (3,): SimplePoly({3: 7, 5: 42, 7: 15}),
            },
        ),
        (
            9,
            {
                (0,): SimplePoly({0: 1, 4: 21, 6: 42}),
                (1,): SimplePoly({3: 7, 5: 42, 7: 15}),
                (2,): SimplePoly({3: 7, 5: 42, 7: 15}),
                (3,): SimplePoly({3: 7, 5: 42, 7: 15}),
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


def test_tensor_enumerator_with_open_legs():
    h = Legos.steane_code_813_encoding_tensor
    te = StabilizerCodeTensorEnumerator(h)
    actual_wep = te.stabilizer_enumerator_polynomial(
        open_legs=[0, 1], truncate_length=None
    )
    print(actual_wep)
    assert actual_wep == {
        (0, 0): SimplePoly({0: 1, 4: 9, 6: 6}),
        (0, 2): SimplePoly({3: 4, 5: 12}),
        (2, 0): SimplePoly({3: 4, 5: 12}),
        (2, 2): SimplePoly({2: 3, 6: 7, 4: 6}),
        (0, 1): SimplePoly({3: 4, 5: 12}),
        (0, 3): SimplePoly({3: 4, 5: 12}),
        (2, 1): SimplePoly({4: 12, 6: 4}),
        (2, 3): SimplePoly({4: 12, 6: 4}),
        (1, 0): SimplePoly({3: 4, 5: 12}),
        (1, 2): SimplePoly({4: 12, 6: 4}),
        (3, 0): SimplePoly({3: 4, 5: 12}),
        (3, 2): SimplePoly({4: 12, 6: 4}),
        (1, 1): SimplePoly({2: 3, 4: 6, 6: 7}),
        (1, 3): SimplePoly({4: 12, 6: 4}),
        (3, 1): SimplePoly({4: 12, 6: 4}),
        (3, 3): SimplePoly({2: 3, 4: 6, 6: 7}),
    }


def test_tensor_enumerator_with_open_legs_t6():
    h = Legos.enconding_tensor_603
    te = StabilizerCodeTensorEnumerator(h)
    actual_wep = te.stabilizer_enumerator_polynomial(
        open_legs=[0, 1], truncate_length=None
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
