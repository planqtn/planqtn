import time
from qlego.codes.rotated_surface_code import RotatedSurfaceCodeTN
from qlego.legos import Legos


if __name__ == "__main__":
    # I want to see that if I truncate higher weight terms from the individual legos, wether the leading term survives or not?
    # well, this is obviously true for the 0 coset, but what about the other guy?
    # full_tn = RotatedSurfaceCodeTN(
    #     d=5,
    #     lego=lambda i: Legos.enconding_tensor_512_z,
    #     coset_error=((), (0, 5, 10, 15, 20)),
    # )

    # print(full_tn.stabilizer_enumerator_polynomial(progress_bar=True))

    d = 15
    err = {25, 30, 45}

    flip = False
    if flip:
        logical_z = {d * i for i in range(d)}
        coset = err.symmetric_difference(logical_z)
        trunc_length = d - len(err)
    else:
        trunc_length = len(err)
        coset = err
    full_tn = RotatedSurfaceCodeTN(
        d=d,
        lego=lambda i: Legos.enconding_tensor_512_z,
        coset_error=((), tuple(coset)),
        truncate_length=len(coset),
    )
    full_tn.analyze_traces(cotengra=d > 5)

    print("-----" * 50)
    print("-----" * 50)
    print("-----" * 50)
    start = time.time()
    print(
        full_tn.stabilizer_enumerator_polynomial(
            cotengra=d > 5, progress_bar=d > 10, verbose=False
        )
    )
    end = time.time()
    print(f"{end-start:0.2f}s")

    print("vs")
    full_tn.set_truncate_length(None)

    start = time.time()
    print(full_tn.stabilizer_enumerator_polynomial(cotengra=d > 5, progress_bar=d > 10))
    end = time.time()
    print(f"{end-start:0.2f}s")
