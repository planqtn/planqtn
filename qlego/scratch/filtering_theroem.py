from qlego.legos import Legos
from qlego.parity_check import sprint, tensor_product


def main():
    h = Legos.enconding_tensor_512
    h = tensor_product(h, Legos.enconding_tensor_512)
    h = tensor_product(h, Legos.enconding_tensor_512)
    h = tensor_product(h, Legos.enconding_tensor_512)

    sprint(h)
    n = h.shape[1] // 2
    wanted_legs = [4, 8, 12, 16]
    wanted_h = Legos.stab_code_parity_422


if __name__ == "__main__":
    main()
