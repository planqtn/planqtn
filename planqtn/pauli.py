class Pauli:
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
        return "".join(Pauli._labels[pauli] for pauli in paulis)
