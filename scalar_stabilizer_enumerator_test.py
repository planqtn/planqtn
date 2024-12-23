from galois import GF2
import numpy as np
from scalar_stabilizer_enumerator import ScalarStabilizerCodeEnumerator


def test_422_code_stabilizer_enumerator():
    assert (
        ScalarStabilizerCodeEnumerator(
            GF2(
                [
                    # fmt: off
        [1,1,1,1, 0,0,0,0],
        [0,0,0,0, 1,1,1,1],
                    # fmt: on
                ]
            )
        ).stabilizer_enumerator()
        == {0: 1, 4: 3}
    )


def test_422_code_normalizer_enumerator():
    assert (
        ScalarStabilizerCodeEnumerator(
            GF2(
                [
                    # fmt: off
        [1,1,1,1, 0,0,0,0],
        [0,0,0,0, 1,1,1,1],
                    # fmt: on
                ]
            )
        ).normalizer_enumerator()
        == {0: 1, 2: 18, 3: 24, 4: 21}
    )


def test_d3rsc_parallel():
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
    wep_single_thread = ScalarStabilizerCodeEnumerator(
        rsc
    ).stabilizer_enumerator_polynomial()

    wep_two_threads = ScalarStabilizerCodeEnumerator(
        rsc
    ).stabilizer_enumerator_polynomial(num_workers=2)
    assert (
        wep_single_thread == wep_two_threads
    ), f"Single thread: {wep_single_thread}\nTwo threads: {wep_two_threads}"
