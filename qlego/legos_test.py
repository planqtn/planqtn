from qlego.legos import Legos
from qlego.tensor_network import StabilizerCodeTensorEnumerator


def test_x_spider_h_is_z_spider():
    x_spider = StabilizerCodeTensorEnumerator(Legos.x_rep_code(3), "x")

    hs = [StabilizerCodeTensorEnumerator(Legos.h, f"h{i}") for i in range(3)]
    print("orig")
    print(x_spider.h)
    print(x_spider.stabilizer_enumerator_polynomial())

    x_spider = x_spider.conjoin(hs[0], [0], [1])
    print("after H-ing leg 0")
    print(x_spider.h)
    print(x_spider.stabilizer_enumerator_polynomial())

    x_spider = x_spider.conjoin(hs[1], [1], [1])
    print("after H-ing leg 1")
    print(x_spider.h)
    print(x_spider.stabilizer_enumerator_polynomial())

    x_spider = x_spider.conjoin(hs[2], [2], [1])
    print("after H-ing leg 2")
    print(x_spider.h)
    print(x_spider.stabilizer_enumerator_polynomial())

    z_spider = StabilizerCodeTensorEnumerator(Legos.z_rep_code(3), "z")
    print(z_spider.h)
    print(z_spider.stabilizer_enumerator_polynomial())

    print(x_spider.h)
    print(x_spider.stabilizer_enumerator_polynomial())

    assert (
        z_spider.stabilizer_enumerator_polynomial()
        == x_spider.stabilizer_enumerator_polynomial()
    )
