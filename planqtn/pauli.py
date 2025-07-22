"""Pauli operator representations."""

import enum
from typing import List
from galois import GF2


_labels: List[str] = [
    "I",
    "X",
    "Z",
    "Y",
]
_gf2_matrices: List[GF2] = [
    GF2([0, 0]),
    GF2([1, 0]),
    GF2([0, 1]),
    GF2([1, 1]),
]


class Pauli(enum.Enum):
    """Pauli operator representations.

    This enum provides a representation of Pauli operators as integers, strings and symplectic GF2
    matrices. It also provides a static method to convert a list of Pauli operators to a string.
    """

    I = 0
    X = 1
    Z = 2
    Y = 3

    def __str__(self) -> str:
        return _labels[self.value]

    def to_gf2(self) -> GF2:
        """Convert a Pauli operator to a GF2 matrix.

        Returns:
            The GF2 matrix representation of the Pauli operator.
        """
        return _gf2_matrices[self.value]

    @staticmethod
    def to_str(*paulis: int) -> str:
        """Convert a list of Pauli operators to a string.

        Args:
            *paulis: The Pauli operators to convert.

        Returns:
            The string representation of the Pauli operators.
        """
        return "".join(_labels[pauli] for pauli in paulis)
