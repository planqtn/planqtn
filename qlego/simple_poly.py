from collections import defaultdict

from typing import Tuple

from sympy import Poly


class MonomialPowers:
    def __init__(self, powers: Tuple[int, ...]):
        self.powers = powers

    def __add__(self, other):
        assert len(self.powers) == len(other.powers)
        return MonomialPowers(
            (self.powers[i] + other.powers[i] for i in range(len(self.powers)))
        )

    def __len__(self):
        return len(self.powers)

    def __getitem__(self, n):
        return self.powers[n]


class SimplePoly:
    def __init__(self, d=None):
        self._dict = defaultdict(int) if d is None else d
        if not d:
            self.num_vars = 1
        elif isinstance(list(d.keys())[0], int):
            self.num_vars = 1
        else:
            self.num_vars = len(list(d.keys())[0])

    def add_inplace(self, other):
        assert other.num_vars == self.num_vars
        for k, v in other._dict.items():
            self._dict[k] += v

    def __add__(self, other):
        assert other.num_vars == self.num_vars
        res = SimplePoly(self._dict)
        for k, v in other._dict.items():
            res._dict[k] += v
        return res

    def __str__(self):
        return str(dict(self._dict))

    def __repr__(self):
        return f"SimplePoly({repr(self._dict)})"

    def __truediv__(self, n):
        if isinstance(n, int | float):
            # TODO: is this really a good idea to always keep coeffs integer?
            return SimplePoly({k: v // n for k, v in self._dict.items()})

    def __eq__(self, value):
        if isinstance(value, int | float):
            return self._dict[0] == value
        return self._dict == value._dict

    def __hash__(self):
        return hash(self._dict)

    def __mul__(self, n):
        if isinstance(n, int | float):
            return SimplePoly({k: n * v for k, v in self._dict.items()})
        elif isinstance(n, SimplePoly):
            res = SimplePoly()
            for d1, coeff1 in self._dict.items():
                for d2, coeff2 in n._dict.items():
                    res._dict[d1 + d2] += coeff1 * coeff2
            return res

    def homogenize(self, n: int):
        if self.num_vars != 1:
            raise ValueError(
                f"We can homogenize only single variable polynomials not {self.num_vars} variable ones."
            )
        return SimplePoly(
            {MonomialPowers((k, n - k)): v for k, v in self._dict.items()}
        )

    def subs(self, fun):
        assert self.num_vars == 2
        for k, v in self._dict.items():
            fun(k, v)

    def to_sympy(self, vars):
        assert self.num_vars == 2

        res = Poly(0, *vars)
        for k, v in self._dict.items():
            res += Poly(v * vars[0] ** k[0] * vars[1] ** k[1])
        return res
