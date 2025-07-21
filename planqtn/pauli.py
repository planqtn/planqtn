"""Pauli operator representations."""


class Pauli:
    """Pauli operator representations.

    This class provides a representation of Pauli operators as integers.
    It also provides a static method to convert a list of Pauli operators
    to a string.
    """

    I = 0
    X = 1
    Z = 2
    Y = 3

    _labels = ["I", "X", "Z", "Y"]

    def __init__(self, pauli: int):
        self.pauli = pauli

    def __str__(self) -> str:
        return self._labels[self.pauli]

    @staticmethod
    def to_str(*paulis: int) -> str:
        """Convert a list of Pauli operators to a string.

        Args:
            *paulis: The Pauli operators to convert.

        Returns:
            The string representation of the Pauli operators.
        """
        return "".join(Pauli._labels[pauli] for pauli in paulis)
