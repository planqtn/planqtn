"""Minimal polynomial representations for the weight enumerator polynomials."""

from typing import Dict, Tuple, Union, Any, Generator, Optional, Callable, List

from sympy import Poly, symbols
import sympy


class MonomialPowers:
    """A class for representing monomial powers in multivariate polynomials.

    This class represents the powers of variables in a monomial term. For example,
    in the monomial x^2 * y^3 * z^1, the powers would be represented as (2, 3, 1).

    Attributes:
        powers: Tuple of integers representing the power of each variable.

    Example:
        # Create monomial powers for x^2 * y^3
        mp = MonomialPowers((2, 3))

        # Add two monomial powers (component-wise addition)
        result = mp + MonomialPowers((1, 1))  # Results in (3, 4)
    """

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
    """A polynomial class using MonomialPowers as keys for multivariate polynomials.

    This class represents multivariate polynomials where each term is stored as
    a dictionary mapping MonomialPowers to coefficients. It's designed for
    bivariate polynomials (2 variables) and provides conversion to/from sympy
    polynomials.

    Attributes:
        dict: Dictionary mapping MonomialPowers to integer coefficients.
        num_vars: Number of variables in the polynomial (typically 2).

    Example:
        # Create a polynomial: 3x^2*y + 2x*y^3
        poly = MonomialPowersPoly({
            MonomialPowers((2, 1)): 3,
            MonomialPowers((1, 3)): 2
        })

        # Convert to sympy polynomial
        sympy_poly = poly.to_sympy([x, y])
    """

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
        """Convert this polynomial to a sympy Poly object.

        Args:
            variables: List of sympy symbols representing the variables.

        Returns:
            Poly: The sympy polynomial representation.

        Raises:
            AssertionError: If the polynomial is not bivariate (2 variables).
        """
        assert self.num_vars == 2

        res = Poly(0, *variables)
        for k, v in self.dict.items():
            res += Poly(v * variables[0] ** k[0] * variables[1] ** k[1])
        return res

    @staticmethod
    def from_sympy(poly: sympy.Poly) -> "MonomialPowersPoly":
        """Convert a sympy Poly to a MonomialPowersPoly.

        For bivariate polynomials, the keys are (i, j) representing w^i * z^j
        where w and z are the two variables.

        Args:
            poly: The sympy polynomial to convert.

        Returns:
            MonomialPowersPoly: The converted polynomial.

        Raises:
            AssertionError: If the polynomial is not bivariate (2 variables).
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
    """A simple univariate polynomial class for weight enumerator polynomials.

    This class represents univariate polynomials as a dictionary mapping
    powers to coefficients. It's specifically designed for weight enumerator
    polynomials used in coding theory, where coefficients are typically integers.

    The class provides basic polynomial operations like addition, multiplication,
    normalization, and MacWilliams dual computation. It also supports truncation
    and homogenization for bivariate polynomials.

    Attributes:
        dict: Dictionary mapping integer powers to integer coefficients.
        num_vars: Number of variables (always 1 for univariate).

    Example:
        # Create a polynomial: 1 + 3x + 2x^2
        poly = SimplePoly({0: 1, 1: 3, 2: 2})

        # Add polynomials
        result = poly + SimplePoly({1: 1, 3: 1})

        # Multiply by scalar
        scaled = poly * 2

        # Get minimum weight term
        min_weight, coeff = poly.minw()
    """

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
        """Check if the polynomial is a scalar (constant term only).

        Returns:
            bool: True if the polynomial has only a constant term (power 0).
        """
        return len(self.dict) == 1 and set(self.dict.keys()) == {0}

    def add_inplace(self, other: "SimplePoly") -> None:
        """Add another polynomial to this one in-place.

        Args:
            other: The polynomial to add to this one.

        Raises:
            AssertionError: If the polynomials have different numbers of variables.
        """
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
        """Get the minimum weight term and its coefficient.

        Returns:
            Tuple containing the minimum power and its coefficient.
        """
        min_w = min(self.dict.keys())
        min_coeff = self.dict[min_w]
        return min_w, min_coeff

    def leading_order_poly(self) -> "SimplePoly":
        """Get the polynomial containing only the minimum weight term.

        Returns:
            SimplePoly: A new polynomial with only the minimum weight term.
        """
        min_w = min(self.dict.keys())
        min_coeff = self.dict[min_w]
        return SimplePoly({min_w: min_coeff})

    def __getitem__(self, i: Any) -> int:
        return self.dict.get(i, 0)

    def items(self) -> Generator[Tuple[Any, int], None, None]:
        """Yield items from the polynomial.

        Yields:
            Tuple[Any, int]: A tuple of the power and coefficient.
        """
        yield from self.dict.items()

    def __len__(self) -> int:
        return len(self.dict)

    def normalize(self, verbose: bool = False) -> "SimplePoly":
        """Normalize the polynomial by dividing by the constant term if it's greater than 1.

        Args:
            verbose: If True, print normalization information.

        Returns:
            SimplePoly: The normalized polynomial.
        """
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
        """Homogenize a univariate polynomial to a bivariate polynomial.

        Converts A(z) to A(w,z) = w^n * A(z/w), where w represents the dual weight
        and z represents the actual weight. This is used in MacWilliams duality.

        Args:
            n: The degree of homogenization.

        Returns:
            MonomialPowersPoly: The homogenized bivariate polynomial.
        """
        return MonomialPowersPoly(
            {MonomialPowers((n - k, k)): v for k, v in self.dict.items()}
        )

    def truncate_inplace(self, n: int) -> None:
        """Truncate the polynomial to terms with power <= n in-place.

        Args:
            n: Maximum power to keep in the polynomial.
        """
        self.dict = {k: v for k, v in self.dict.items() if k <= n}

    def macwilliams_dual(
        self, n: int, k: int, to_normalizer: bool = True
    ) -> "SimplePoly":
        """Convert this weight enumerator polynomial to its MacWilliams dual.

        The MacWilliams duality theorem relates the weight enumerator polynomial
        of a code to that of its dual code. This method implements the transformation
        A(z) -> B(z) = (1 + z)^n * A((1 - z)/(1 + z)) / 2^k.

        Args:
            n: Length of the code.
            k: Dimension of the code.
            to_normalizer: If True, compute the normalizer enumerator polynomial.
                          If False, compute the weight enumerator polynomial.
                          This affects the normalization factors.

        Returns:
            SimplePoly: The MacWilliams dual weight enumerator polynomial.
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
