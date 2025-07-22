from planqtn.poly import UnivariatePoly


def test_normalizer_enumerator_polynomial_513():
    # the [[5,1,3]] code's normalizer enumerator polynomial
    n = 5
    k = 1
    polynomial = UnivariatePoly({0: 1, 4: 15})
    poly_b = polynomial.macwilliams_dual(n=n, k=k)
    assert poly_b == UnivariatePoly({0: 1, 3: 30, 4: 15, 5: 18})

    poly_a = poly_b.macwilliams_dual(n=n, k=k, to_normalizer=False)
    assert poly_a == UnivariatePoly({0: 1, 4: 15})


def test_normalizer_enumerator_polynomial_422():
    # the [[4,2,2]] code's normalizer enumerator polynomial
    n = 4
    k = 2
    polynomial = UnivariatePoly({0: 1, 4: 3})
    poly_b = polynomial.macwilliams_dual(n=n, k=k)
    assert poly_b == UnivariatePoly({0: 1, 2: 18, 3: 24, 4: 21})

    poly_a = poly_b.macwilliams_dual(n=n, k=k, to_normalizer=False)
    assert poly_a == UnivariatePoly({0: 1, 4: 3})
