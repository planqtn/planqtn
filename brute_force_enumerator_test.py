from galois import GF2
import numpy as np
from brute_force_enumerator import BruteForceStabilizerCodeEnumerator


def test_422_code_stabilizer_enumerator():
    assert (
        BruteForceStabilizerCodeEnumerator(
            GF2(
                [
                    # fmt: off
        [1,1,1,1, 0,0,0,0],
        [0,0,0,0, 1,1,1,1],
                    # fmt: on
                ]
            )
        ).get_stabilizer_enumerator()
        == {0: 1, 4: 3}
    )


def test_422_code_normalizer_enumerator():
    assert (
        BruteForceStabilizerCodeEnumerator(
            GF2(
                [
                    # fmt: off
        [1,1,1,1, 0,0,0,0],
        [0,0,0,0, 1,1,1,1],
                    # fmt: on
                ]
            )
        ).get_normalizer_enumerator()
        == {0: 1, 2: 18, 3: 24, 4: 21}
    )
