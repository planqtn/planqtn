from galois import GF2
import numpy as np

from linalg import gauss, right_kernel


def test_right_kernel():
    mx = GF2(
        [
            [0, 1, 0],
            [1, 0, 0],
            [0, 0, 1],
        ]
    )
    assert np.all(mx @ right_kernel(mx).T == 0), mx @ right_kernel(mx).T

    np.testing.assert_array_equal(right_kernel(mx), GF2([[0, 0, 0]]))

    mx = GF2(
        [
            [0, 1, 0],
            [0, 1, 0],
            [0, 0, 1],
        ]
    )

    print(mx)
    print(right_kernel(mx).T)
    print(mx @ right_kernel(mx).T)
    np.testing.assert_array_equal(right_kernel(mx), GF2([[1, 0, 0]]))
    assert np.all(
        (mx @ right_kernel(mx).T) == 0
    ), f"Not zero: \n{mx @ right_kernel(mx).T}"


def test_gauss_noswaps():
    mx = GF2(
        [
            [0, 1, 0],
            [1, 0, 0],
            [0, 0, 1],
        ]
    )

    np.testing.assert_array_equal(gauss(mx, noswaps=True), mx)
    np.testing.assert_array_equal(gauss(mx, noswaps=False), GF2.Identity(3))


def test_gauss_col_subset():
    mx = GF2(
        [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 1],
        ]
    )

    np.testing.assert_array_equal(
        gauss(mx, col_subset=[0, 1]),
        GF2(
            [
                [1, 0, 1],
                [0, 1, 1],
                [0, 0, 1],
            ]
        ),
    )


def test_gauss_col_subset_fail_to_extract():
    mx = GF2(
        [
            [1, 1, 0],
            [1, 1, 1],
            [0, 0, 1],
        ]
    )

    np.testing.assert_array_equal(
        gauss(mx, col_subset=[0, 1]),
        GF2(
            [
                [1, 1, 0],
                [0, 0, 1],
                [0, 0, 1],
            ]
        ),
    )
