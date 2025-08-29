from planqtn.networks.holographic_happy_code import HolographicHappyTN
from planqtn.legos import Legos
from planqtn.poly import UnivariatePoly
from planqtn.tensor_network import StabilizerCodeTensorEnumerator


def test_layer1_happy():
    tn = HolographicHappyTN(num_layers=1)
    assert tn.n_qubits() == 5, f"Got {tn.n_qubits()} qubits, expected 5"

    wep = tn.stabilizer_enumerator_polynomial(cotengra=True, verbose=True)

    wep_correct = UnivariatePoly({0: 1, 4: 15})
    assert wep == wep_correct, f"Not equal: {wep} vs {wep_correct}"


def test_layer2_happy():
    tn = HolographicHappyTN(num_layers=2)
    assert tn.n_qubits() == 25, f"Got {tn.n_qubits()} qubits, expected 25"

    wep = tn.stabilizer_enumerator_polynomial(cotengra=True, verbose=True)

    wep_correct = UnivariatePoly(
        {0: 1, 8: 15, 12: 120, 14: 480, 16: 2655, 18: 5280, 20: 5688, 22: 1920, 24: 225}
    )
    assert wep == wep_correct, f"Not equal: {wep} vs {wep_correct}"


def test_layer3_happy():
    tn = HolographicHappyTN(num_layers=3)
    assert tn.n_qubits() == 95, f"Got {tn.n_qubits()} qubits, expected 95"


def test_layer2_creation():
    tn = HolographicHappyTN(num_layers=2)

    nodes = {}
    nodes[(0, 0)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(0, 0))

    nodes[(1, 0)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 0))
    nodes[(1, 1)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 1))
    nodes[(1, 2)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 2))
    nodes[(1, 3)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 3))
    nodes[(1, 4)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 4))

    nodes[(1, 5)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 5))
    nodes[(1, 6)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 6))
    nodes[(1, 7)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 7))
    nodes[(1, 8)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 8))
    nodes[(1, 9)] = StabilizerCodeTensorEnumerator(Legos.perf513, tensor_id=(1, 9))

    assert tn._traces == [
        ((0, 0), (1, 0), [((0, 0), 0)], [((1, 0), 0)]),
        ((0, 0), (1, 1), [((0, 0), 1)], [((1, 1), 0)]),
        ((0, 0), (1, 2), [((0, 0), 2)], [((1, 2), 0)]),
        ((0, 0), (1, 3), [((0, 0), 3)], [((1, 3), 0)]),
        ((0, 0), (1, 4), [((0, 0), 4)], [((1, 4), 0)]),
        ((1, 5), (1, 0), [((1, 5), 0)], [((1, 0), 1)]),
        ((1, 5), (1, 1), [((1, 5), 1)], [((1, 1), 1)]),
        ((1, 6), (1, 1), [((1, 6), 0)], [((1, 1), 2)]),
        ((1, 6), (1, 2), [((1, 6), 1)], [((1, 2), 1)]),
        ((1, 7), (1, 2), [((1, 7), 0)], [((1, 2), 2)]),
        ((1, 7), (1, 3), [((1, 7), 1)], [((1, 3), 1)]),
        ((1, 8), (1, 3), [((1, 8), 0)], [((1, 3), 2)]),
        ((1, 8), (1, 4), [((1, 8), 1)], [((1, 4), 1)]),
        ((1, 9), (1, 4), [((1, 9), 0)], [((1, 4), 2)]),
        ((1, 9), (1, 0), [((1, 9), 1)], [((1, 0), 2)]),
    ], "Traces are not equal, got:\n" + "\n".join(str(tr) for tr in tn._traces)

    assert tn._legs_left_to_join == {
        (0, 0): [((0, 0), 0), ((0, 0), 1), ((0, 0), 2), ((0, 0), 3), ((0, 0), 4)],
        (1, 0): [((1, 0), 0), ((1, 0), 1), ((1, 0), 2)],
        (1, 1): [((1, 1), 0), ((1, 1), 1), ((1, 1), 2)],
        (1, 2): [((1, 2), 0), ((1, 2), 1), ((1, 2), 2)],
        (1, 3): [((1, 3), 0), ((1, 3), 1), ((1, 3), 2)],
        (1, 4): [((1, 4), 0), ((1, 4), 1), ((1, 4), 2)],
        (1, 5): [((1, 5), 0), ((1, 5), 1)],
        (1, 6): [((1, 6), 0), ((1, 6), 1)],
        (1, 7): [((1, 7), 0), ((1, 7), 1)],
        (1, 8): [((1, 8), 0), ((1, 8), 1)],
        (1, 9): [((1, 9), 0), ((1, 9), 1)],
    }, "Legs to trace are not equal, got:\n" + str(tn._legs_left_to_join)
