import pytest
from tensor_legs import TensorLegs


def test_tensor_legs_default_naming():

    tl1 = TensorLegs(5)
    for i in range(5):
        assert tl1[i] == i

    assert tl1.num_legs == 5

    tl2 = TensorLegs(6)
    assert tl2.num_legs == 6

    tl3 = tl1.conjoin(tl2, [3, 4], [5, 0])

    # the first tensor's legs stay the same,
    assert tl3[0] == 0
    assert tl3[1] == 1
    assert tl3[2] == 2
    # traced out
    assert tl3[3] is None
    # traced out
    assert tl3[4] is None

    # the second is shifted by len(first)
    assert tl3[tl1.num_legs + 0] is None
    assert tl3[tl1.num_legs + 1] == tl1.num_legs + 1
    assert tl3[tl1.num_legs + 2] == tl1.num_legs + 2
    assert tl3[tl1.num_legs + 3] == tl1.num_legs + 3
    assert tl3[tl1.num_legs + 4] == tl1.num_legs + 4
    assert tl3[tl1.num_legs + 5] is None

    assert tl3.num_legs == 7

    with pytest.raises(ValueError):
        tl3.conjoin(tl3, [6], [7])
