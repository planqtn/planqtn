"""Minimal polynomial representations for the weight enumerator polynomials."""

from typing import Dict, Tuple, Union, Any, Generator, Optional

from sympy import Poly, symbols
import sympy


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
                assert isinstance(
                    first_key, int
                ), f"First key is not an int: {first_key} is type {type(first_key)}"
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

    def truncate_inplace(self, n: int) -> None:
        """Truncate the polynomial to terms with power <= n in-place.

        Args:
            n: Maximum power to keep in the polynomial.
        """
        self.dict = {k: v for k, v in self.dict.items() if k <= n}

    def to_sympy(self, variable: sympy.Symbol) -> Poly:
        """Convert this polynomial to a sympy Poly object.

        Args:
            variable: sympy symbol representing the variable.

        Returns:
            Poly: The sympy polynomial representation.
        """
        res = Poly(0, variable)
        for k, v in self.dict.items():
            res += Poly(f"{v} * {variable}^{k}")
        return res

    @staticmethod
    def from_sympy(poly: sympy.Poly) -> "UnivariatePoly":
        """Convert a sympy Poly to a UnivariatePoly.

        For bivariate polynomials, the keys are (i, j) representing w^i * z^j
        where w and z are the two variables.

        Args:
            poly: The sympy polynomial to convert.

        Returns:
            BivariatePoly: The converted polynomial.

        Raises:
            AssertionError: If the polynomial is not bivariate (2 variables).
        """
        assert len(poly.gens) == 1
        return UnivariatePoly(
            {k[0] if isinstance(k, tuple) else k: v for k, v in poly.as_dict().items()}
        )

    def macwilliams_dual(
        self, n: int, k: int, to_normalizer: bool = True
    ) -> "UnivariatePoly":
        """Convert this weight enumerator polynomial to its MacWilliams dual.

        The MacWilliams duality theorem relates the weight enumerator polynomial
        of a code to that of its dual code. This method implements the transformation
        A(z) -> B(z) = (1 + 3z)^n * A((1 - z)/(1 + 3z)).

        Args:
            n: Length of the code.
            k: Dimension of the code.
            to_normalizer: If True, compute the normalizer enumerator polynomial.
                          If False, compute the weight enumerator polynomial.
                          This affects the normalization factors.

        Returns:
            UnivariatePoly: The MacWilliams dual weight enumerator polynomial.
        """
        z = symbols("z")
        spoly = self.to_sympy(z)

        sympy_substituted = Poly(
            (
                spoly.subs({z: (1 - z) / (1 + 3 * z)})
                * (1 + 3 * z) ** n
                / (2 ** (n - k if to_normalizer else n + k))
            ).simplify(),
            z,
        )

        return UnivariatePoly.from_sympy(sympy_substituted)
