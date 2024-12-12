from galois import GF2
import numpy as np
import pytest
from parity_check import conjoin


# Handle empty matrices as input
def test_conjoin_empty_matrices():
    h1 = GF2([[]])
    h2 = GF2([[]])

    with pytest.raises(AssertionError):
        conjoin(h1, h2)


def test_conjoin_missing_leading_ones():
    h1 = GF2(
        [
            [0, 1, 1, 1, 0, 0, 0, 0],  # Missing leading 1 in the first column
            [0, 0, 0, 0, 1, 1, 1, 1],
        ]
    )
    h2 = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1],  # Missing leading 1 in the second column
        ]
    )
    with pytest.raises(AssertionError):
        conjoin(h1, h2)


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


def test_conjoin_single_trace_713_codes():

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
    np.testing.assert_array_equal(
        res,
        GF2(
            [
                # fmt: off
                    # h1[0, x]       # h2[0, x]     # h1[0, z]       # h2[0, z]
                [0, 1, 0, 1, 0, 1,   1, 1, 1,      0, 0, 0, 0, 0, 0,  0, 0, 0 ],
                    # h1[1, x]       # h2[1, x]     # h1[1, z]       # h2[1, z]                
                [0, 0, 0, 0, 0, 0,   0, 0, 0,      0, 1, 0, 1, 0, 1,  1, 1, 1],
                [0, 0, 1, 1, 1, 1,   0, 0, 0,      0, 0, 0, 0, 0, 0,  0, 0, 0],  
                [1, 1, 0, 0, 1, 1,   0, 0, 0,      0, 0, 0, 0, 0, 0,  0, 0, 0],    
                [0, 0, 0, 0, 0, 0,   0, 0, 0,      0, 0, 1, 1, 1, 1,  0, 0, 0],
                [0, 0, 0, 0, 0, 0,   0, 0, 0,      1, 1, 0, 0, 1, 1,  0, 0, 0],
                # fmt: on
            ]
        ),
    )
