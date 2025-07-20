from typing import Dict, Tuple, Union, Any, Generator, Optional, Callable, List

from sympy import Poly, symbols
import sympy


class MonomialPowers:
    def __init__(self, powers: Tuple[int, ...] | "MonomialPowers") -> None:
        self.powers: Tuple[int, ...] = (
            powers if isinstance(powers, tuple) else powers.powers
        )

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


class MonomialPowersPoly:
    def __init__(
        self,
        d: Union[Dict[Tuple[int, ...] | MonomialPowers, int], "MonomialPowersPoly"],
    ) -> None:
        self.dict: Dict[MonomialPowers, int] = {}
        self.num_vars = 2
        assert d is not None
        if isinstance(d, MonomialPowersPoly):
            self.dict.update(d.dict)
            self.num_vars = d.num_vars
        elif isinstance(d, dict):
            if len(d) > 0:
                first_key = list(d.keys())[0]
                self.num_vars = len(first_key)
                self.dict.update(
                    {MonomialPowers(key): value for key, value in d.items()}
                )
        else:
            raise ValueError(f"Unrecognized type: {type(d)}")

    def _subs(self, fun: Callable[[Any, int], None]) -> None:
        assert self.num_vars == 2
        for k, v in self.dict.items():
            fun(k, v)

    def to_sympy(self, variables: List[Any]) -> Poly:
        assert self.num_vars == 2

        res = Poly(0, *variables)
        for k, v in self.dict.items():
            res += Poly(v * variables[0] ** k[0] * variables[1] ** k[1])
        return res

    @staticmethod
    def from_sympy(poly: sympy.Poly) -> "MonomialPowersPoly":
        """
        Convert a sympy Poly (univariate or multivariate) to a SimplePoly.
        For bivariate: keys are (i, j) for w^i z^j.
        """
        assert len(poly.gens) == 2
        return MonomialPowersPoly(poly.as_dict())

    def __mul__(
        self, n: Union[int, float, "MonomialPowersPoly"]
    ) -> "MonomialPowersPoly":
        if isinstance(n, (int, float)):
            return MonomialPowersPoly({k: int(n * v) for k, v in self.dict.items()})
        raise TypeError(f"Cannot multiply MonomialPowersPoly by {type(n)}")


class SimplePoly:
    def __init__(self, d: Optional[Union["SimplePoly", Dict[int, int]]] = None) -> None:
        self.dict: Dict[int, int] = {}
        self.num_vars = 1
        if isinstance(d, SimplePoly):
            self.dict.update(d.dict)
        elif d is not None and isinstance(d, dict):
            self.dict.update(d)
            if len(d) > 0:
                first_key = list(self.dict.keys())[0]
                assert isinstance(first_key, int)
        elif d is not None:
            raise ValueError(f"Unrecognized type: {type(d)}")

    def is_scalar(self) -> bool:
        return len(self.dict) == 1 and set(self.dict.keys()) == {0}

    def add_inplace(self, other: "SimplePoly") -> None:
        assert other.num_vars == self.num_vars
        for k, v in other.dict.items():
            self.dict[k] = self.dict.get(k, 0) + v

    def __add__(self, other: "SimplePoly") -> "SimplePoly":
        assert other.num_vars == self.num_vars
        res = SimplePoly(self.dict)
        for k, v in other.dict.items():
            res.dict[k] = res.dict.get(k, 0) + v
        return res

    def minw(self) -> Tuple[Any, int]:
        min_w = min(self.dict.keys())
        min_coeff = self.dict[min_w]
        return min_w, min_coeff

    def leading_order_poly(self) -> "SimplePoly":
        min_w = min(self.dict.keys())
        min_coeff = self.dict[min_w]
        return SimplePoly({min_w: min_coeff})

    def __getitem__(self, i: Any) -> int:
        return self.dict.get(i, 0)

    def items(self) -> Generator[Tuple[Any, int], None, None]:
        yield from self.dict.items()

    def __len__(self) -> int:
        return len(self.dict)

    def normalize(self, verbose: bool = False) -> "SimplePoly":

        if 0 in self.dict and self.dict[0] > 1:
            if verbose:
                print(f"normalizing WEP by 1/{self.dict[0]}")
            return self / self.dict[0]
        return self

    def __str__(self) -> str:
        return (
            "{"
            + ", ".join([f"{w}:{self.dict[w]}" for w in sorted(list(self.dict.keys()))])
            + "}"
        )

    def __repr__(self) -> str:
        return f"SimplePoly({repr(self.dict)})"

    def __truediv__(self, n: int) -> "SimplePoly":
        if isinstance(n, int):
            return SimplePoly({k: int(v // n) for k, v in self.dict.items()})
        raise TypeError(f"Cannot divide SimplePoly by {type(n)}")

    def __eq__(self, value: object) -> bool:
        if isinstance(value, (int, float)):
            return self.dict[0] == value
        if isinstance(value, SimplePoly):
            return self.dict == value.dict
        return False

    def __hash__(self) -> int:
        return hash(self.dict)

    def __mul__(self, n: Union[int, float, "SimplePoly"]) -> "SimplePoly":
        if isinstance(n, (int, float)):
            return SimplePoly({k: int(n * v) for k, v in self.dict.items()})
        if isinstance(n, SimplePoly):
            res = SimplePoly()
            for d1, coeff1 in self.dict.items():
                for d2, coeff2 in n.dict.items():
                    res.dict[d1 + d2] = res.dict.get(d1 + d2, 0) + coeff1 * coeff2
            return res
        raise TypeError(f"Cannot multiply SimplePoly by {type(n)}")

    def _homogenize(self, n: int) -> "MonomialPowersPoly":
        """Homogenize a polynomial in n variables to a polynomial in 2 variables.

        From the single A(z) => A(w,z) = w**n A(z/n), thus the first element of the monomial keys is
        w (the dual weight), the second is z (which is still the actual weight).
        """
        return MonomialPowersPoly(
            {MonomialPowers((n - k, k)): v for k, v in self.dict.items()}
        )

    def truncate_inplace(self, n: int) -> None:
        self.dict = {k: v for k, v in self.dict.items() if k <= n}

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
        homogenized: MonomialPowersPoly = self._homogenize(n) * factors[0]
        z, w = symbols("w z")
        sp_homogenized = homogenized.to_sympy([w, z])

        sympy_substituted = Poly(
            sp_homogenized.subs({w: (w + 3 * z) / 2, z: (w - z) / 2}).simplify()
            / factors[1],
            w,
            z,
        )

        monomial_powers_substituted: MonomialPowersPoly = MonomialPowersPoly.from_sympy(
            sympy_substituted
        )

        single_var_dict = {}

        for key, value in monomial_powers_substituted.dict.items():
            assert key[1] not in single_var_dict
            single_var_dict[key[1]] = value

        return SimplePoly(single_var_dict)
