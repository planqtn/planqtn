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
        ).stabilizer_enumerator
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
        ).normalizer_enumerator
        == {0: 1, 2: 18, 3: 24, 4: 21}
    )
