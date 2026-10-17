import itertools

import numpy as np
import pytest

from planqtn.gates import Gates, bitwise
from planqtn.legos import Legos
from planqtn.phase_polynomial import SupportCoordinates
from planqtn.signed_stabilizer_tensor import SignedStabilizerTensor
from planqtn.transversal import logical_action

ENCODERS = {
    "qrm": (Legos.qrm15_encoding_tensor, [15]),
    "steane": (Legos.steane_code_813_encoding_tensor, [7]),
    "832": (Legos.code832_encoding_tensor, [8, 9, 10]),
    "513": (Legos.perf513_encoding_tensor, [5]),
}

DIAGONAL_GATES = [
    Gates.T,
    Gates.T_DAG,
    Gates.S,
    Gates.Z,
    Gates.CZ,
    Gates.CS,
    Gates.CCZ,
    Gates.controlled_phase(2, 1, 8),
    Gates.controlled_phase(3, 3, 8),
    Gates.phase(1, 16),
    Gates.phase(1, 3),
    Gates.controlled_phase(2, 1, 6),
]


def legs(name, indices):
    return [(name, i) for i in indices]


def qrm(name):
    return SignedStabilizerTensor(Legos.qrm15_encoding_tensor, name)


def evaluate(polynomial, y):
    return sum(
        c for monomial, c in polynomial.terms().items() if all(y[i] for i in monomial)
    )


def brute_force_phases(tensor, coordinates, ops, order):
    """θ(offset + y basis) for all y, directly from the gate matrices."""
    resolved = tensor.resolve_ops(ops)
    values = []
    for y in itertools.product([0, 1], repeat=coordinates.dimension):
        x = (coordinates.offset + np.array(y, dtype=np.int64) @ coordinates.basis) % 2
        theta = 0
        for gate, qubits in resolved:
            exponents, gate_order = gate.diagonal_phases()
            key = int("".join(str(int(x[q])) for q in qubits), 2)
            theta += exponents[key] * (order // gate_order)
        values.append((y, theta % order))
    return values


def random_network(rng, deformation_choices):
    """Two encoding tensors traced on one random physical leg each."""
    names = list(ENCODERS)
    kinds = [names[i] for i in rng.choice(len(names), size=2)]
    blocks = []
    for name, kind in zip("ab", kinds):
        h, logical = ENCODERS[kind]
        blocks.append((SignedStabilizerTensor(h, name), [(name, i) for i in logical]))
    (a, logical_a), (b, logical_b) = blocks
    leg_a = int(
        rng.choice([i for i in range(a.n) if (a.tensor_id, i) not in logical_a])
    )
    leg_b = int(
        rng.choice([i for i in range(b.n) if (b.tensor_id, i) not in logical_b])
    )
    deformation = deformation_choices[rng.integers(len(deformation_choices))]
    tensor = a.merge_with(b, [leg_a], [leg_b], [deformation])
    return tensor, logical_a + logical_b, deformation


def random_diagonal_ops(rng, physical, num_gates):
    ops = []
    free = list(physical)
    rng.shuffle(free)
    for _ in range(num_gates):
        gate = DIAGONAL_GATES[rng.integers(len(DIAGONAL_GATES))]
        if len(free) < gate.num_qubits:
            break
        ops.append((gate, tuple(free[: gate.num_qubits])))
        del free[: gate.num_qubits]
    return ops


@pytest.mark.parametrize("seed", range(6))
def test_polynomial_matches_brute_force_on_the_whole_support(seed):
    rng = np.random.default_rng(seed)
    tensor, logical, _ = random_network(rng, [None, Gates.X, Gates.S])
    coordinates = SupportCoordinates(tensor, logical)
    physical = [leg for leg in tensor.legs if leg not in logical]
    ops = random_diagonal_ops(rng, physical, 6)
    polynomial = coordinates.polynomial(ops)
    for y, theta in brute_force_phases(tensor, coordinates, ops, polynomial.order):
        assert evaluate(polynomial, y) % polynomial.order == theta, (y, ops)


@pytest.mark.parametrize("seed", range(40))
def test_polynomial_method_agrees_with_enumeration(seed):
    rng = np.random.default_rng(100 + seed)
    if seed % 2:
        tensor, logical, _ = random_network(rng, [None, Gates.X, Gates.Y, Gates.H])
        physical = [leg for leg in tensor.legs if leg not in logical]
        ops = random_diagonal_ops(rng, physical, int(rng.integers(1, 8)))
    else:
        tensor, logical, deformation = random_network(rng, [None, Gates.X])
        gate = [Gates.T, Gates.S][seed % 4 // 2]
        ops = [
            (gate if leg[0] == "a" or deformation else gate.dagger(), (leg,))
            for leg in tensor.legs
            if leg not in logical
        ]
    try:
        logical_action(tensor, logical, [], method="clifford")
    except ValueError:
        with pytest.raises(ValueError, match="isometry"):
            logical_action(tensor, logical, ops, method="diagonal")
        return
    polynomial = logical_action(tensor, logical, ops, method="diagonal")
    enumeration = logical_action(tensor, logical, ops, method="enumerate")
    assert (polynomial is None) == (enumeration is None)
    if polynomial is not None:
        assert polynomial.equals(enumeration.matrix())
        assert polynomial.phase_polynomial() == enumeration.phase_polynomial()


def test_degree_bounds():
    """The monomial degree is bounded by the gate degree and order, not by the support."""
    code = qrm("a").merge_with(qrm("b"), [0], [0], [Gates.X])
    coordinates = SupportCoordinates(code, [("a", 15), ("b", 15)])
    physical = [leg for leg in code.legs if leg[1] != 15]
    half = len(physical) // 2
    pairs = list(zip(physical[:half], physical[half:]))
    triples = list(zip(physical[0:9], physical[9:18], physical[18:27]))
    for ops, bound in (
        (bitwise(Gates.T, physical), 3),
        (bitwise(Gates.S, physical), 2),
        ([(Gates.CS, p) for p in pairs], 3),
        ([(Gates.CCZ, t) for t in triples], 3),
        ([(Gates.controlled_phase(2, 1, 8), p) for p in pairs], 4),
    ):
        assert 0 < coordinates.polynomial(ops).degree <= bound


def test_coordinates():
    code = qrm("a").merge_with(qrm("b"), [0], [0], [Gates.X])
    logical = [("b", 15), ("a", 15)]
    coordinates = SupportCoordinates(code, logical)
    assert coordinates.logical_legs == logical
    assert coordinates.num_logical == 2
    columns = [code.legs.index(leg) for leg in logical]
    assert np.array_equal(coordinates.basis[:, columns][:2], np.eye(2))
    assert not coordinates.basis[2:, columns].any()
    assert not coordinates.offset[columns].any()
    support = {tuple(p) for p in code.support().tolist()}
    for y in itertools.product([0, 1], repeat=coordinates.dimension):
        x = (coordinates.offset + np.array(y) @ coordinates.basis) % 2
        assert tuple(x.tolist()) in support
    assert len(support) == 2**coordinates.dimension


def test_errors():
    with pytest.raises(ValueError, match="not a stabilizer state"):
        SupportCoordinates(SignedStabilizerTensor(Legos.perf513))
    ghz = SignedStabilizerTensor(Legos.z_rep_code(3))
    with pytest.raises(ValueError, match="isometry"):
        SupportCoordinates(ghz, [0, 1])
    plus_i_and_bell = SignedStabilizerTensor.from_pauli_strings(["YII", "IXX", "IZZ"])
    with pytest.raises(ValueError, match="isometry"):
        SupportCoordinates(plus_i_and_bell, [0])
    with pytest.raises(ValueError, match="Repeated"):
        SupportCoordinates(ghz, [0, 0])
    with pytest.raises(ValueError, match="not diagonal"):
        SupportCoordinates(ghz).polynomial([(Gates.H, (0,))])


def test_symmetries_without_logical_legs():
    ghz = SignedStabilizerTensor(Legos.z_rep_code(4))
    coordinates = SupportCoordinates(ghz)
    assert coordinates.polynomial(
        [(Gates.T, (0,)), (Gates.T_DAG, (1,)), (Gates.CS, (2, 3))]
    ).terms() == {(0,): 2}
    symmetry = coordinates.polynomial([(Gates.T, (0,)), (Gates.T_DAG, (1,))])
    assert symmetry.terms() == {} and symmetry.is_logical
    assert not coordinates.polynomial([(Gates.T, (0,))]).is_logical


def test_concatenated_qrm_has_transversal_t():
    """[[225,1,9]]: support dimension 65, far beyond enumeration."""
    code = qrm("o")
    for i in range(15):
        code = code.merge_with(qrm(f"i{i}"), [i], [15])
    physical = [leg for leg in code.legs if leg != ("o", 15)]
    assert len(physical) == 225
    assert SupportCoordinates(code, [("o", 15)]).dimension == 65
    action = logical_action(code, [("o", 15)], bitwise(Gates.T, physical))
    assert str(action) == "T(o:15)"
    assert logical_action(code, [("o", 15)], bitwise(Gates.T, physical[1:])) is None
    inner_block = legs("i3", range(15))
    assert logical_action(code, [("o", 15)], bitwise(Gates.T, inner_block)) is None


@pytest.mark.parametrize("blocks", [4, 8])
def test_ghz_joined_qrm_codes_scale(blocks):
    """Lemma 3.16 for many blocks: addressable CZ, and T only in T/T† pairs."""
    code = SignedStabilizerTensor(Legos.z_rep_code(blocks), "g")
    for i in range(blocks):
        code = code.merge_with(qrm(f"q{i}"), [("g", i)], [0])
    logical = [(f"q{i}", 15) for i in range(blocks)]
    assert SupportCoordinates(code, logical).dimension > 20 or blocks == 4
    face = [1, 3, 5, 7, 9, 11, 13]
    a, b = 1, blocks - 1
    cz = logical_action(
        code,
        logical,
        bitwise(Gates.CZ, legs(f"q{a}", face), legs(f"q{b}", face)),
        method="diagonal",
    )
    assert cz.phase_polynomial() == {(logical[a], logical[b]): 1}
    t_pair = bitwise(Gates.T, legs(f"q{a}", range(1, 15))) + bitwise(
        Gates.T_DAG, legs(f"q{b}", range(1, 15))
    )
    assert logical_action(code, logical, t_pair).phase_polynomial() == {
        (logical[a],): 7,
        (logical[b],): 1,
    }
    assert (
        logical_action(code, logical, bitwise(Gates.T, legs("q0", range(1, 15))))
        is None
    )


@pytest.mark.parametrize("tiles", [2, 6])
def test_x_deformed_832_line_has_ccz_on_every_tile(tiles):
    """Sec. 4.2.2: [[8,3,2]] tiles traced in a line with Φ_X edges, T^⊗n = CCZ^⊗(L+1)."""
    odd = [1, 2, 4, 7]
    code = None
    for t in range(tiles):
        tile = SignedStabilizerTensor(Legos.code832_encoding_tensor, f"c{t}").apply(
            bitwise(Gates.X, legs(f"c{t}", odd))
        )
        code = (
            tile
            if code is None
            else code.merge_with(tile, [(f"c{t - 1}", 0)], [(f"c{t}", 3)], [Gates.X])
        )
    logical = [(f"c{t}", i) for t in range(tiles) for i in (8, 9, 10)]
    physical = [leg for leg in code.legs if leg not in logical]
    assert len(physical) == 6 * tiles + 2
    action = logical_action(code, logical, bitwise(Gates.T, physical))
    assert action.phase_polynomial() == {
        tuple(logical[3 * t : 3 * t + 3]): 4 for t in range(tiles)
    }
