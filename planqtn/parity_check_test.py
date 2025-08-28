from galois import GF2
import numpy as np
from planqtn.parity_check import conjoin, self_trace, tensor_product
from planqtn.symplectic import sprint
from planqtn.tensor_network import StabilizerCodeTensorEnumerator


# Handle empty matrices as input
def test_conjoin_empty_matrices():
    h1 = GF2([])
    h2 = GF2([[]])

    np.testing.assert_array_equal(conjoin(h1, h2), GF2([[1]]))


def test_conjoin_to_zero():
    h1 = GF2([[1, 0]])
    h2 = GF2([[0, 1]])
    h3 = conjoin(h1, h2, 0, 0)
    assert np.array_equal(h3, GF2([[0]]))


def test_conjoin_to_one():
    h1 = GF2([[1, 0]])
    h2 = GF2([[1, 0]])
    h3 = conjoin(h1, h2, 0, 0)
    assert np.array_equal(h3, GF2([[1]]))


def test_tensor_product_with_scalar_0():
    h1 = GF2([[0]])
    h2 = GF2([[1, 0]])
    h3 = tensor_product(h1, h2)
    assert np.array_equal(h3, GF2([[0]]))


def test_tensor_product_with_scalar_1():
    h1 = GF2([[1]])
    h2 = GF2([[1, 0]])
    h3 = tensor_product(h1, h2)
    assert np.array_equal(h3, h2)


def test_tensor_with_free_qubit():
    h1 = GF2([[1, 0, 0, 1], [0, 1, 1, 0]])

    h2 = GF2([[0, 0]])
    assert np.array_equal(
        tensor_product(h1, h2),
        GF2(
            [
                [1, 0, 0, 0, 1, 0],
                [0, 1, 0, 1, 0, 0],
            ]
        ),
    )

    assert np.array_equal(
        tensor_product(h2, h1),
        GF2(
            [
                [0, 1, 0, 0, 0, 1],
                [0, 0, 1, 0, 1, 0],
            ]
        ),
    )


def test_conjoin_with_free_qubit():
    h1 = GF2([[1, 0, 0, 1], [0, 1, 1, 0]])
    h2 = GF2([[0, 0]])
    h3 = conjoin(h1, h2, 0, 0)
    assert np.array_equal(h3, GF2([[0, 0]]))


def test_tensor_two_free_qubits():
    h1 = GF2([[0, 0]])

    h2 = GF2([[0, 0]])
    h3 = tensor_product(h1, h2)
    assert np.array_equal(
        h3,
        GF2([[0, 0, 0, 0]]),
    )


def test_conjoin_single_trace_422_codes():
    np.testing.assert_array_equal(
        conjoin(
            h1=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0],
                    [0, 0, 0, 0, 1, 1, 1, 1],
                ]
            ),
            h2=GF2(
                [
                    [1, 1, 1, 1, 0, 0, 0, 0],
                    [0, 0, 0, 0, 1, 1, 1, 1],
                ]
            ),
        ),
        GF2(
            [
                [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1],
            ]
        ),
    )


def test_conjoin_single_trace_713_code_with_422_code():

    res = conjoin(
        h1=GF2(
            [
                # fmt: off
                    [1,  0, 1, 0, 1, 0, 1,   0,  0, 0, 0, 0, 0, 0],
                    [0,  0, 0, 0, 0, 0, 0,   1,  0, 1, 0, 1, 0, 1],
                            # A1                     # B1
                    [0,  0, 0, 1, 1, 1, 1,   0,  0, 0, 0, 0, 0, 0],
                    [0,  1, 1, 0, 0, 1, 1,   0,  0, 0, 0, 0, 0, 0],
                    [0,  0, 0, 0, 0, 0, 0,   0,  0, 0, 1, 1, 1, 1],
                    [0,  0, 0, 0, 0, 0, 0,   0,  1, 1, 0, 0, 1, 1],
                # fmt: on
            ]
        ),
        h2=GF2(
            [
                # fmt: off
                    [1,  1, 1, 1,   0,  0, 0, 0],
                    [0,  0, 0, 0,   1,  1, 1, 1],
                # fmt: on
            ]
        ),
    )
    print(res)
    expected = GF2(
        [
            # fmt: off
            # pylint: disable=trailing-whitespace
                    # h1[0, x]       # h2[0, x]     # h1[0, z]       # h2[0, z]
                [0, 1, 0, 1, 0, 1,   1, 1, 1,      0, 0, 0, 0, 0, 0,  0, 0, 0 ],
                    # h1[1, x]       # h2[1, x]     # h1[1, z]       # h2[1, z]
                [0, 0, 0, 0, 0, 0,   0, 0, 0,      0, 1, 0, 1, 0, 1,  1, 1, 1],
                [0, 0, 0, 0, 0, 0,   0, 0, 0,      0, 0, 1, 1, 1, 1,  0, 0, 0],
                [0, 0, 0, 0, 0, 0,   0, 0, 0,      1, 1, 0, 0, 1, 1,  0, 0, 0],
                [0, 0, 1, 1, 1, 1,   0, 0, 0,      0, 0, 0, 0, 0, 0,  0, 0, 0],
                [1, 1, 0, 0, 1, 1,   0, 0, 0,      0, 0, 0, 0, 0, 0,  0, 0, 0],
            # fmt: on
        ]
    )

    assert (
        StabilizerCodeTensorEnumerator(expected).stabilizer_enumerator_polynomial()
        == StabilizerCodeTensorEnumerator(res).stabilizer_enumerator_polynomial()
    )


def test_conjoin_single_trace_713_code_with_713_code():

    res = conjoin(
        h1=GF2(
            [
                # fmt: off
                    [1,  0, 1, 0, 1, 0, 1,   0,  0, 0, 0, 0, 0, 0],
                    [0,  0, 0, 0, 0, 0, 0,   1,  0, 1, 0, 1, 0, 1],
                            # A1                     # B1
                    [0,  0, 0, 1, 1, 1, 1,   0,  0, 0, 0, 0, 0, 0],
                    [0,  1, 1, 0, 0, 1, 1,   0,  0, 0, 0, 0, 0, 0],
                    [0,  0, 0, 0, 0, 0, 0,   0,  0, 0, 1, 1, 1, 1],
                    [0,  0, 0, 0, 0, 0, 0,   0,  1, 1, 0, 0, 1, 1],
                # fmt: on
            ]
        ),
        h2=GF2(
            [
                # fmt: off
                    [1,  0, 1, 0, 1, 0, 1,   0,  0, 0, 0, 0, 0, 0],
                    [0,  0, 0, 0, 0, 0, 0,   1,  0, 1, 0, 1, 0, 1],
                            # A2                     # B2
                    [0,  0, 0, 1, 1, 1, 1,   0,  0, 0, 0, 0, 0, 0],
                    [0,  1, 1, 0, 0, 1, 1,   0,  0, 0, 0, 0, 0, 0],
                    [0,  0, 0, 0, 0, 0, 0,   0,  0, 0, 1, 1, 1, 1],
                    [0,  0, 0, 0, 0, 0, 0,   0,  1, 1, 0, 0, 1, 1],
                # fmt: on
            ]
        ),
    )
    np.set_printoptions(linewidth=800)
    sprint(res)
    expected = GF2(
        [
            # fmt: off
                    # h1[0, x]       # h2[0, x]                # h1[0, z]       # h2[0, z]
                [0, 1, 0, 1, 0, 1,   0, 1, 0, 1, 0, 1,   0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0],
                    # h1[1, x]       # h2[1, x]                # h1[1, z]       # h2[1, z]
                [0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0,   0, 1, 0, 1, 0, 1,   0, 1, 0, 1, 0, 1],
                      # A1                                  # B1
                [0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0,   0, 0, 1, 1, 1, 1,   0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0,   1, 1, 0, 0, 1, 1,   0, 0, 0, 0, 0, 0],
                [0, 0, 1, 1, 1, 1,   0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0],
                [1, 1, 0, 0, 1, 1,   0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0],
                                           #A2                                       # B2
                [0, 0, 0, 0, 0, 0,   0, 0, 1, 1, 1, 1,   0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0,   1, 1, 0, 0, 1, 1,   0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0,   0, 0, 1, 1, 1, 1],
                [0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0,   0, 0, 0, 0, 0, 0,   1, 1, 0, 0, 1, 1],
            # fmt: on
        ]
    )
    assert (
        StabilizerCodeTensorEnumerator(expected).stabilizer_enumerator_polynomial()
        == StabilizerCodeTensorEnumerator(res).stabilizer_enumerator_polynomial()
    )


def test_self_trace_():
    res = self_trace(
        GF2(
            [
                # fmt: off
        [1,1,1,1,1,1, 1,1,0,0,0,0],
        [0,1,0,0,0,0, 0,0,0,0,1,1],
        # kept rows
        [0,0,0,0,0,0, 0,0,1,0,0,1],
        [0,0,0,0,0,0, 0,0,0,1,0,1]
                # fmt: on
            ]
        )
    )
    np.testing.assert_array_equal(
        res,
        GF2(
            [
                # fmt: off
        [1,1,1,1, 0,0,0,0],
        # kept rows
        [0,0,0,0, 1,0,0,1],
        [0,0,0,0, 0,1,0,1]
                # fmt: on
            ]
        ),
    )

    res = self_trace(
        GF2(
            [
                # fmt: off
        [1,1,1,1,1,1, 0,0,0,0,0,0],
        [0,0,0,0,0,0, 0,1,0,0,1,0],
        [0,0,0,0,0,0, 1,0,1,0,0,0],
        [0,0,0,0,0,0, 0,0,0,1,0,1]
                # fmt: on
            ]
        )
    )
    np.testing.assert_array_equal(
        res,
        GF2(
            [
                # fmt: off
        [1,1,1,1, 0,0,0,0],
        [0,0,0,0, 1,0,1,0],
        [0,0,0,0, 0,1,0,1]
                # fmt: on
            ]
        ),
    )


def test_two_422_codes_are_the_steane_code():

    h1 = GF2(
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

    h2 = h1.copy()

    h3 = conjoin(h1, h2, 4, 4)

    assert all(
        np.count_nonzero(row) >= 3 for row in h3
    ), f"Some rows have less than 3 weight\n{h3}"
    # # the remaining of the original logical legs are now 4 and 9
    h4 = self_trace(h3, 4, 9)
    print(repr(h4))
    steane = GF2(
        [
            [1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1],
            [0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0],
            [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
            [0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        ]
    )
    assert np.array_equal(h4, steane), f"not equal\n{h4}"


def test_conjoin_with_no_error_correcting_on_h1():
    h1 = GF2(
        [
            [1, 0, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 1],
        ]
    )
    h2 = GF2(
        [
            [0, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 0],
        ]
    )

    h3 = conjoin(h1, h2, 1, 0)

    assert np.array_equal(
        h3,
        GF2(
            [
                [0, 0, 0, 0, 1, 1, 1, 0],
                [0, 0, 1, 1, 0, 0, 0, 0],
                [1, 1, 0, 0, 0, 0, 0, 0],
            ]
        ),
    ), f"not equal\n{repr(h3)}"


def test_self_trace_edge_case_with_repeated_pivot_row_removal():
    h = GF2(
        [
            [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1],
            [0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1],
        ]
    )

    res = self_trace(h, 1, 2)
    assert np.array_equal(
        GF2(
            [
                [0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
                [0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0],
                [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1],
            ]
        ),
        res,
    )

    h = GF2(
        [
            [1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 1],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
        ]
    )

    res = self_trace(h, 4, 5)
    print(repr(res))
    assert np.array_equal(
        GF2(
            [
                [0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1],
                [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
                [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            ]
        ),
        res,
    )
