"""Minimal polynomial representations for the weight enumerator polynomials."""

from typing import Dict, Tuple, Union, Any, Generator, Optional, Callable, List

from sympy import Poly, symbols
import sympy


class Monomial:
    """A class for representing variable powers in a monomial.

    This class represents the powers of variables in a monomial. For example,
    in the monomial x^2 * y^3 * z^1, the powers would be represented as (2, 3, 1).

    Attributes:
        powers: Tuple of integers representing the power of each variable.

    Example:
        ```python
        >>> # Create the monomial for x^2 * y^3
        >>> mp = Monomial((2, 3))

        >>> # Add two monomials (component-wise addition)
        >>> mp + Monomial((1, 1))  # Results in (3, 4)
        Monomial((3, 4))

        ```
    """

    def __init__(self, powers: Tuple[int, ...] | "Monomial") -> None:
        """Construct a monomial powers.

        Args:
            powers: The powers of the monomial.
        """
        self.powers: Tuple[int, ...] = (
            powers if isinstance(powers, tuple) else powers.powers
        )

    def __add__(self, other: "Monomial") -> "Monomial":
        assert len(self.powers) == len(other.powers)
        return Monomial(
            tuple(self.powers[i] + other.powers[i] for i in range(len(self.powers)))
        )

    def __len__(self) -> int:
        return len(self.powers)

    def __getitem__(self, n: int) -> int:
        return self.powers[n]

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Monomial):
            return NotImplemented
        return self.powers == other.powers

    def __lt__(self, other: "Monomial") -> bool:
        return self.powers < other.powers

    def __gt__(self, other: "Monomial") -> bool:
        return self.powers > other.powers

    def __le__(self, other: "Monomial") -> bool:
        return self.powers <= other.powers

    def __ge__(self, other: "Monomial") -> bool:
        return self.powers >= other.powers

    def __hash__(self) -> int:
        return hash(self.powers)

    def __str__(self) -> str:
        return str(self.powers)

    def __repr__(self) -> str:
        return f"Monomial({self.powers})"


class BivariatePoly:
    """A class for bivariate integer polynomials.

    The keys are [Monomial][planqtn.poly.Monomial] and the values are integer coefficients.
    """

    def __init__(
        self,
        d: Union[Dict[Tuple[int, ...] | Monomial, int], "BivariatePoly"],
    ) -> None:
        """Construct a bivariate polynomial.

        This class represents bivariate polynomials where each term is stored as
        a dictionary mapping [Monomial][planqtn.poly.Monomial] to coefficients.
        It provides conversion to/from sympy polynomials. This is used mainly for the MacWilliams
        dual computation.

        Attributes:
            dict: Dictionary mapping [Monomial][planqtn.poly.Monomial] to integer
                  coefficients.

        Args:
            d: The dictionary of monomials and coefficients.

        Raises:
            ValueError: If the input is not a dictionary or a BivariatePoly.
        """
        self.dict: Dict[Monomial, int] = {}
        self.num_vars = 2
        assert d is not None
        if isinstance(d, BivariatePoly):
            self.dict.update(d.dict)
            self.num_vars = d.num_vars
        elif isinstance(d, dict):
            if len(d) > 0:
                first_key = list(d.keys())[0]
                self.num_vars = len(first_key)
                self.dict.update({Monomial(key): value for key, value in d.items()})
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
    def from_sympy(poly: sympy.Poly) -> "BivariatePoly":
        """Convert a sympy Poly to a BivariatePoly.

        For bivariate polynomials, the keys are (i, j) representing w^i * z^j
        where w and z are the two variables.

        Args:
            poly: The sympy polynomial to convert.

        Returns:
            BivariatePoly: The converted polynomial.

        Raises:
            AssertionError: If the polynomial is not bivariate (2 variables).
        """
        assert len(poly.gens) == 2
        return BivariatePoly(poly.as_dict())

    def __mul__(self, n: Union[int, float, "BivariatePoly"]) -> "BivariatePoly":
        if isinstance(n, (int, float)):
            return BivariatePoly({k: int(n * v) for k, v in self.dict.items()})
        raise TypeError(f"Cannot multiply BivariatePoly by {type(n)}")


class UnivariatePoly:
    """A class for univariate integer polynomials."""

    def __init__(
        self, d: Optional[Union["UnivariatePoly", Dict[int, int]]] = None
    ) -> None:
        """Construct a univariate integer polynomial.

        This class represents univariate polynomials as a dictionary mapping
        powers to coefficients. It's specifically designed for weight enumerator
        polynomials, where coefficients are typically integers.

        The class provides basic polynomial operations like addition, multiplication,
        normalization, and MacWilliams dual computation. It also supports truncation
        and homogenization for bivariate polynomials.

        Attributes:
            dict: Dictionary mapping integer powers to integer coefficients.
            num_vars: Number of variables (always 1 for univariate).

        Raises:
            ValueError: If the input is not a dictionary or a UnivariatePoly.

        Example:
            ```python

            >>> # Create a polynomial: 1 + 3x + 2x^2
            >>> poly = UnivariatePoly({0: 1, 1: 3, 2: 2})

            >>> # Add polynomials
            >>> result = poly + UnivariatePoly({1: 1, 3: 1})

            >>> # Multiply by scalar
            >>> scaled = poly * 2

            >>> # Get minimum weight term
            >>> min_weight, coeff = poly.minw()
            >>> min_weight
            0
            >>> coeff
            1

            ```

        Args:
            d: The dictionary of powers and coefficients.
        """
        self.dict: Dict[int, int] = {}
        self.num_vars = 1
        if isinstance(d, UnivariatePoly):
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

    def add_inplace(self, other: "UnivariatePoly") -> None:
        """Add another polynomial to this one in-place.

        Args:
            other: The polynomial to add to this one.

        Raises:
            AssertionError: If the polynomials have different numbers of variables.
        """
        assert other.num_vars == self.num_vars
        for k, v in other.dict.items():
            self.dict[k] = self.dict.get(k, 0) + v

    def __add__(self, other: "UnivariatePoly") -> "UnivariatePoly":
        assert other.num_vars == self.num_vars
        res = UnivariatePoly(self.dict)
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

    def leading_order_poly(self) -> "UnivariatePoly":
        """Get the polynomial containing only the minimum weight term.

        Returns:
            UnivariatePoly: A new polynomial with only the minimum weight term.
        """
        min_w = min(self.dict.keys())
        min_coeff = self.dict[min_w]
        return UnivariatePoly({min_w: min_coeff})

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

    def normalize(self, verbose: bool = False) -> "UnivariatePoly":
        """Normalize the polynomial by dividing by the constant term if it's greater than 1.

        Args:
            verbose: If True, print normalization information.

        Returns:
            UnivariatePoly: The normalized polynomial.
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
        return f"UnivariatePoly({repr(self.dict)})"

    def __truediv__(self, n: int) -> "UnivariatePoly":
        if isinstance(n, int):
            return UnivariatePoly({k: int(v // n) for k, v in self.dict.items()})
        raise TypeError(f"Cannot divide UnivariatePoly by {type(n)}")

    def __eq__(self, value: object) -> bool:
        if isinstance(value, (int, float)):
            return self.dict[0] == value
        if isinstance(value, UnivariatePoly):
            return self.dict == value.dict
        return False

    def __hash__(self) -> int:
        return hash(self.dict)

    def __mul__(self, n: Union[int, float, "UnivariatePoly"]) -> "UnivariatePoly":
        if isinstance(n, (int, float)):
            return UnivariatePoly({k: int(n * v) for k, v in self.dict.items()})
        if isinstance(n, UnivariatePoly):
            res = UnivariatePoly()
            for d1, coeff1 in self.dict.items():
                for d2, coeff2 in n.dict.items():
                    res.dict[d1 + d2] = res.dict.get(d1 + d2, 0) + coeff1 * coeff2
            return res
        raise TypeError(f"Cannot multiply UnivariatePoly by {type(n)}")

    def _homogenize(self, n: int) -> "BivariatePoly":
        """Homogenize a univariate polynomial to a bivariate polynomial.

        Converts A(z) to A(w,z) = w^n * A(z/w), where w represents the dual weight
        and z represents the actual weight. This is used in MacWilliams duality.

        Args:
            n: The degree of homogenization.

        Returns:
            BivariatePoly: The homogenized bivariate polynomial.
        """
        return BivariatePoly({Monomial((n - k, k)): v for k, v in self.dict.items()})

    def truncate_inplace(self, n: int) -> None:
        """Truncate the polynomial to terms with power <= n in-place.

        Args:
            n: Maximum power to keep in the polynomial.
        """
        self.dict = {k: v for k, v in self.dict.items() if k <= n}

    def macwilliams_dual(
        self, n: int, k: int, to_normalizer: bool = True
    ) -> "UnivariatePoly":
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
            UnivariatePoly: The MacWilliams dual weight enumerator polynomial.
        """
        factors = [4**k, 2**k] if to_normalizer else [2**k, 4**k]
        homogenized: BivariatePoly = self._homogenize(n) * factors[0]
        z, w = symbols("w z")
        sp_homogenized = homogenized.to_sympy([w, z])

        sympy_substituted = Poly(
            sp_homogenized.subs({w: (w + 3 * z) / 2, z: (w - z) / 2}).simplify()
            / factors[1],
            w,
            z,
        )

        monomial_powers_substituted: BivariatePoly = BivariatePoly.from_sympy(
            sympy_substituted
        )

        single_var_dict = {}

        for key, value in monomial_powers_substituted.dict.items():
            assert key[1] not in single_var_dict
            single_var_dict[key[1]] = value

        return UnivariatePoly(single_var_dict)
