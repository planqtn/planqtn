from collections import defaultdict

from typing import Dict, Tuple, Union, Any, Generator, Optional, Callable, List

from sympy import Poly, symbols
import sympy


class MonomialPowers:
    def __init__(self, powers: Tuple[int, ...]) -> None:
        self.powers = powers

    def __add__(self, other: "MonomialPowers") -> "MonomialPowers":
        assert len(self.powers) == len(other.powers)
        return MonomialPowers(
            tuple(self.powers[i] + other.powers[i] for i in range(len(self.powers)))
        )

    def __len__(self) -> int:
        return len(self.powers)

    def __getitem__(self, n: int) -> int:
        return self.powers[n]

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, MonomialPowers):
            return NotImplemented
        return self.powers == other.powers

    def __lt__(self, other: "MonomialPowers") -> bool:
        return self.powers < other.powers

    def __gt__(self, other: "MonomialPowers") -> bool:
        return self.powers > other.powers

    def __le__(self, other: "MonomialPowers") -> bool:
        return self.powers <= other.powers

    def __ge__(self, other: "MonomialPowers") -> bool:
        return self.powers >= other.powers

    def __hash__(self) -> int:
        return hash(self.powers)

    def __str__(self) -> str:
        return str(self.powers)

    def __repr__(self) -> str:
        return f"MonomialPowers({self.powers})"


Key = Union[int, MonomialPowers]


class SimplePoly[K: Key]:
    def __init__(self, d: Optional[Union["SimplePoly", Dict[K, int]]] = None) -> None:
        self._dict: Dict[K, int] = dict()
        self.num_vars = 1
        if isinstance(d, SimplePoly):
            self._dict.update(d._dict)
            self.num_vars = d.num_vars
        elif d is not None and isinstance(d, Dict):
            self._dict.update(d)
            if len(d) > 0:
                first_key = list(self._dict.keys())[0]
                if isinstance(first_key, (tuple, MonomialPowers)):
                    self.num_vars = len(first_key)
                elif not isinstance(first_key, int):
                    raise ValueError(
                        f"Unrecognized key type: {type(first_key)} for {first_key} in dictionary passed:\n{d}"
                    )

    def is_scalar(self) -> bool:
        return len(self._dict) == 1 and set(self._dict.keys()) == {0}

    def add_inplace(self, other: "SimplePoly") -> None:
        assert other.num_vars == self.num_vars
        for k, v in other._dict.items():
            self._dict[k] = self._dict.get(k, 0) + v

    def __add__(self, other: "SimplePoly") -> "SimplePoly":
        assert other.num_vars == self.num_vars
        res = SimplePoly(self._dict)
        for k, v in other._dict.items():
            res._dict[k] = res._dict.get(k, 0) + v
        return res

    def minw(self) -> Tuple[Any, int]:
        min_w = min(self._dict.keys())
        min_coeff = self._dict[min_w]
        return min_w, min_coeff

    def leading_order_poly(self) -> "SimplePoly":
        min_w = min(self._dict.keys())
        min_coeff = self._dict[min_w]
        return SimplePoly({min_w: min_coeff})

    def __getitem__(self, i: Any) -> int:
        return self._dict.get(i, 0)

    def items(self) -> Generator[Tuple[Any, int], None, None]:
        yield from self._dict.items()

    def __len__(self) -> int:
        return len(self._dict)

    def normalize(self, verbose: bool = False) -> "SimplePoly":
        if 0 in self._dict and self._dict[0] > 1:
            if verbose:
                print(f"normalizing WEP by 1/{self._dict[0]}")
            return self / self._dict[0]
        return self

    def __str__(self) -> str:
        return (
            "{"
            + ", ".join(
                [f"{w}:{self._dict[w]}" for w in sorted(list(self._dict.keys()))]
            )
            + "}"
        )

    def __repr__(self) -> str:
        return f"SimplePoly({repr(self._dict)})"

    def __truediv__(self, n: Union[int, float]) -> "SimplePoly":
        if isinstance(n, (int, float)):
            # TODO: is this really a good idea to always keep coeffs integer?
            return SimplePoly({k: int(v // n) for k, v in self._dict.items()})
        raise TypeError(f"Cannot divide SimplePoly by {type(n)}")

    def __eq__(self, value: object) -> bool:
        if isinstance(value, (int, float)):
            return self._dict[0] == value
        if isinstance(value, SimplePoly):
            return self._dict == value._dict
        return False

    def __hash__(self) -> int:
        return hash(self._dict)

    def __mul__(self, n: Union[int, float, "SimplePoly"]) -> "SimplePoly":
        if isinstance(n, (int, float)):
            return SimplePoly({k: int(n * v) for k, v in self._dict.items()})
        elif isinstance(n, SimplePoly):
            res = SimplePoly()
            for d1, coeff1 in self._dict.items():
                for d2, coeff2 in n._dict.items():
                    res._dict[d1 + d2] = res._dict.get(d1 + d2, 0) + coeff1 * coeff2
            return res
        raise TypeError(f"Cannot multiply SimplePoly by {type(n)}")

    def _homogenize(self, n: int) -> "SimplePoly":
        """Homogenize a polynomial in n variables to a polynomial in 2 variables.

        From the single A(z) => A(w,z) = w**n A(z/n), thus the first element of the monomial keys is w (the dual weight),
        the second is z (which is still the actual weight).
        """
        if self.num_vars != 1:
            raise ValueError(
                f"We can homogenize only single variable polynomials not {self.num_vars} variable ones."
            )
        return SimplePoly(
            {MonomialPowers((n - k, k)): v for k, v in self._dict.items()}
        )

    def _subs(self, fun: Callable[[Any, int], None]) -> None:
        assert self.num_vars == 2
        for k, v in self._dict.items():
            fun(k, v)

    def _to_sympy(self, vars: List[Any]) -> Poly:
        assert self.num_vars == 2

        res = Poly(0, *vars)
        for k, v in self._dict.items():
            res += Poly(v * vars[0] ** k[0] * vars[1] ** k[1])
        return res

    def truncate_inplace(self, n: int) -> None:
        self._dict = {k: v for k, v in self._dict.items() if k <= n}

    @staticmethod
    def from_sympy(poly: sympy.Poly) -> "SimplePoly":
        """
        Convert a sympy Poly (univariate or multivariate) to a SimplePoly.
        For bivariate: keys are (i, j) for w^i z^j.
        """
        d = {}
        for powers, coeff in poly.as_dict().items():
            key = powers if len(poly.gens) > 1 else powers[0]
            d[key] = coeff
        return SimplePoly(d)

    def macwilliams_dual(
        self, n: int, k: int, to_normalizer: bool = True
    ) -> "SimplePoly":
        """Convert to this unnormalized WEP to its MacWilliams dual WEP.

        If to_normalizer is True, the result is the normalizer enumerator polynomial.
        Otherwise, it is the WEP. This is important for the normalization factors.

        Returns:
            SimplePoly: the MacWilliams dual WEP.
        """
        factors = [4**k, 2**k] if to_normalizer else [2**k, 4**k]
        res = self._homogenize(n) * factors[0]
        z, w = symbols("w z")
        res = res._to_sympy([w, z])

        res = Poly(
            res.subs({w: (w + 3 * z) / 2, z: (w - z) / 2}).simplify() / factors[1], w, z
        )

        res = SimplePoly.from_sympy(res)

        single_var_dict = {}

        for k, v in res._dict.items():
            assert k[1] not in single_var_dict
            single_var_dict[k[1]] = v

        res = SimplePoly(single_var_dict)

        return res
