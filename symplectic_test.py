from galois import GF2
from symplectic import weight


def test_weight():
    assert weight(GF2([1, 0, 0, 0, 0, 0])) == 1
    assert weight(GF2([1, 0, 0, 1, 0, 0])) == 1
    assert weight(GF2([0, 0, 0, 1, 0, 0])) == 1
    assert weight(GF2([0, 1, 0, 1, 0, 0])) == 2
    assert weight(GF2([0, 1, 1, 1, 1, 0])) == 3
