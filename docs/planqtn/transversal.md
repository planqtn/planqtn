# Transversal gates with signed tensors

The parity check matrices of PlanqTN LEGOs live over GF(2), which is all that
weight enumerators need. Gates beyond Paulis, like the transversal T gate of a
quantum Reed-Muller code, are sensitive to the signs of the stabilizers too, and
to how the LEGOs are glued together. Following ChunJun Cao and Brad Lackey,
["Quantum Lego Power-up: Designing Transversal Gates with Tensor Networks"](https://arxiv.org/abs/2603.03542)
(2026), the PlanqTN library can:

- represent LEGOs with signed stabilizers,
  [`SignedStabilizerTensor`](reference.md#planqtn.signed_stabilizer_tensor.SignedStabilizerTensor),
- trace legs through Clifford-deformed edge states `|Φ_C⟩ = (I ⊗ C)|Φ+⟩` and GHZ
  hyperedges,
- find the logical gate that a physical operator implements, with
  [`logical_action`](reference.md#planqtn.transversal.logical_action), in
  polynomial time also for non-Clifford diagonal gates,
- find cleaning operators, push symmetries through networks, search for
  transversal and addressable gates, and analyze how faults spread through them.

The physical operators are products of [gates](reference.md#planqtn.gates) on
tensor legs. This covers strongly and weakly transversal gates, gates between
code blocks and gates on a subset of the legs.

## Why signs matter

Tracing two [[15,1,3]] quantum Reed-Muller codes through the Bell state, or
through the X-deformed edge state `|Φ_X⟩ = (I ⊗ X)|Φ+⟩`, gives the same parity
check matrix. Only the second one keeps the bitwise T gate a logical gate,
because `T ⊗ T` fixes `|Φ_X⟩` up to a phase but not `|Φ+⟩` (Lemma 3.2 of the
paper):

```python
>>> from planqtn.gates import Gates, bitwise
>>> from planqtn.legos import Legos
>>> from planqtn.signed_stabilizer_tensor import SignedStabilizerTensor
>>> from planqtn.transversal import logical_action
>>> a = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="a")
>>> b = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="b")
>>> bell = a.merge_with(b, [0], [0])
>>> x_edge = a.merge_with(b, [0], [0], deformations=[Gates.X])
>>> bool((bell.h == x_edge.h).all())
True
>>> logical = [("a", 15), ("b", 15)]
>>> physical = [leg for leg in bell.legs if leg not in logical]
>>> print(logical_action(bell, logical, bitwise(Gates.T, physical)))
None
>>> print(logical_action(x_edge, logical, bitwise(Gates.T, physical)))
T†(a:15) · T†(b:15)

```

## Gates on legs

A [`Gate`](reference.md#planqtn.gates.Gate) wraps a unitary matrix, and
[`Gates`](reference.md#planqtn.gates.Gates) has the common ones, including `SH`
and Gottesman's `K3`. A physical operator is a list of `(gate, legs)` pairs on
disjoint legs, where a leg is a `(tensor_id, index)` tuple, or just an index on
a single LEGO. [`bitwise`](reference.md#planqtn.gates.bitwise) builds the usual
bitwise ones, for example CZ between the matching legs of two blocks:

```python
>>> bitwise(Gates.CZ, [("a", 1), ("a", 2)], [("b", 1), ("b", 2)])
[(Gate('CZ'), (('a', 1), ('b', 1))), (Gate('CZ'), (('a', 2), ('b', 2)))]

```

## Deformed traces

[`merge_with`](reference.md#planqtn.signed_stabilizer_tensor.SignedStabilizerTensor.merge_with)
and
[`self_trace`](reference.md#planqtn.signed_stabilizer_tensor.SignedStabilizerTensor.self_trace)
take an optional single qubit Clifford for each traced leg pair, which acts on
the leg of the second tensor. A trace that annihilates the tensor raises a
[`ContractionVanishesError`](reference.md#planqtn.signed_stabilizer_tensor.ContractionVanishesError).
GHZ hyperedges are traces with a
[`Legos.z_rep_code`](reference.md#planqtn.Legos.z_rep_code) tensor.

Tensor networks built with [`TensorNetwork`](reference.md#planqtn.TensorNetwork)
can be contracted into a signed tensor, with deformations for some of the traced
leg pairs. For example, two [[5,1,3]] codes traced through `|Φ_Y⟩` give an
[[8,2,3]] code with a strongly transversal SH gate (Section 4.1.1 of the paper):

```python
>>> from planqtn import StabilizerCodeTensorEnumerator, TensorNetwork
>>> tn = TensorNetwork([
...     StabilizerCodeTensorEnumerator(Legos.perf513_encoding_tensor, tensor_id="a"),
...     StabilizerCodeTensorEnumerator(Legos.perf513_encoding_tensor, tensor_id="b"),
... ])
>>> tn.self_trace("a", "b", [0], [0])
>>> code = SignedStabilizerTensor.from_tensor_network(
...     tn, deformations={(("a", 0), ("b", 0)): Gates.Y}
... )
>>> logical = [("a", 5), ("b", 5)]
>>> physical = [leg for leg in code.legs if leg not in logical]
>>> action = logical_action(code, logical, bitwise(Gates.SH, physical))
>>> action.equals(bitwise(Gates.SH, logical))
True

```

## Logical action

[`logical_action`](reference.md#planqtn.transversal.logical_action) takes a
stabilizer state, e.g. an encoding tensor or a network of them, its logical legs
and a physical operator on the other legs. It returns `None` if the operator is
not a logical gate. Otherwise it returns:

- for Clifford gates, a
  [`CliffordLogicalAction`](reference.md#planqtn.transversal.CliffordLogicalAction)
  with the images of the logical Pauli operators,
- for diagonal gates, which need not be Clifford, a
  [`DiagonalLogicalAction`](reference.md#planqtn.transversal.DiagonalLogicalAction)
  with the logical phase polynomial.

Both can be compared to an expected gate with
[`equals`](reference.md#planqtn.transversal.LogicalAction.equals) and turned
into a matrix.

```python
>>> five = SignedStabilizerTensor(Legos.perf513_encoding_tensor, tensor_id="f")
>>> print(logical_action(five, [5], bitwise(Gates.SH, range(5))))
Clifford on (f:5): X -> +Z, Z -> +Y

```

The bitwise T gate of the [[8,3,2]] cube code is not just a logical CCZ, but T
on the even weight vertices and T† on the odd weight vertices is:

```python
>>> cube = SignedStabilizerTensor(Legos.code832_encoding_tensor, tensor_id="c")
>>> print(logical_action(cube, [8, 9, 10], bitwise(Gates.T, range(8))))
Z(c:8) · Z(c:9) · Z(c:10) · CZ(c:8, c:9) · CZ(c:8, c:10) · CZ(c:9, c:10) · CCZ(c:8, c:9, c:10)
>>> even, odd = [0, 3, 5, 6], [1, 2, 4, 7]
>>> ops = bitwise(Gates.T, even) + bitwise(Gates.T_DAG, odd)
>>> print(logical_action(cube, [8, 9, 10], ops))
CCZ(c:8, c:9, c:10)

```

The diagonal method doesn't enumerate the support of the tensor, which grows
exponentially with the number of X-type stabilizers. It writes the phase of the
operator on the support as a multilinear polynomial over the integers modulo the
order of the phases, in coordinates where the logical bits are coordinates
themselves (see
[`planqtn.phase_polynomial`](reference.md#planqtn.phase_polynomial)). The
operator is a logical gate exactly when every monomial with a non-logical
coordinate vanishes, which generalizes the triorthogonality conditions of codes
with a transversal T gate. For phases of order `2^m`, a gate of degree `t` only
contributes monomials of degree up to `t + m - 1`, so this takes polynomial
time. For example, the concatenated [[225,1,9]] quantum Reed-Muller code has a
support of dimension 65:

```python
>>> from planqtn.phase_polynomial import SupportCoordinates
>>> concatenated = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="o")
>>> for i in range(15):
...     inner = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id=f"i{i}")
...     concatenated = concatenated.merge_with(inner, [i], [15])
>>> physical = [leg for leg in concatenated.legs if leg != ("o", 15)]
>>> len(physical), SupportCoordinates(concatenated, [("o", 15)]).dimension
(225, 65)
>>> print(logical_action(concatenated, [("o", 15)], bitwise(Gates.T, physical)))
T(o:15)

```

The monomials that prevent an operator from being a logical gate are its
obstructions:

```python
>>> qrm = SignedStabilizerTensor(Legos.qrm15_encoding_tensor, tensor_id="q")
>>> polynomial = SupportCoordinates(qrm, [15]).polynomial(bitwise(Gates.T, range(14)))
>>> polynomial.is_logical, polynomial.degree, len(polynomial.obstructions())
(False, 3, 24)

```

The enumeration is still available with `method="enumerate"`, to cross-check
small examples.

## Cleaning operators

Some logical gates need a cleaning operator next to the transversal part
(Definition 2.5 of the paper). Three Steane codes joined by a GHZ hyperedge have
a CZ between any two logical qubits, made of CZs between the two blocks and Z
gates on the third block (Figure 9 of the paper):

```python
>>> code = SignedStabilizerTensor(Legos.z_rep_code(3), tensor_id="g")
>>> for i in range(3):
...     steane = SignedStabilizerTensor(
...         Legos.steane_code_813_encoding_tensor, tensor_id=f"s{i}"
...     )
...     code = code.merge_with(steane, [("g", i)], [0])
>>> logical = [("s0", 7), ("s1", 7), ("s2", 7)]
>>> cz = bitwise(Gates.CZ, [("s0", i) for i in range(1, 7)], [("s1", i) for i in range(1, 7)])
>>> print(logical_action(code, logical, cz))
None
>>> z_gates = bitwise(Gates.Z, [("s2", 2), ("s2", 4), ("s2", 6)])
>>> action = logical_action(code, logical, cz + z_gates)
>>> action.equals([(Gates.CZ, (("s0", 7), ("s1", 7)))])
True

```

[`find_cleaning`](reference.md#planqtn.transversal.find_cleaning) finds such
Pauli corrections. For Clifford operators it solves a linear system over GF(2)
for the sign mismatches of the conjugated stabilizers, for diagonal operators it
fixes obstructions of degree 1 with Z gates. Corrections are unique up to
stabilizers and logical Pauli operators, so give the expected logical gate as a
target to get it exactly, and optionally the legs the correction may act on:

```python
>>> from planqtn.transversal import find_cleaning
>>> target = [(Gates.CZ, (("s0", 7), ("s1", 7)))]
>>> third_block = [("s2", i) for i in range(1, 7)]
>>> cleaning = find_cleaning(code, logical, cz, target=target, legs=third_block)
>>> cleaning.correction
[(Gate('Z'), (('s2', 2),)), (Gate('Z'), (('s2', 3),)), (Gate('Z'), (('s2', 5),))]
>>> cleaning.action.equals(target)
True

```

The corrected operator `cleaning.ops` merges corrections into the gates on the
same legs, e.g. `(ZI)·CZ` for the intrablock CZ of two Steane codes traced
through the Bell state (Figure 7 of the paper).

## Designing networks with symmetries

A unitary symmetry of a LEGO stays a symmetry of a network when the gates on the
two legs of every trace fix the edge state (the matching lemma, Lemma 3.2 of the
paper).
[`compatible_deformations`](reference.md#planqtn.symmetries.compatible_deformations)
lists the Clifford-deformed edge states `|Φ_C⟩` that `U ⊗ U` fixes, and
[`edge_deformation`](reference.md#planqtn.symmetries.edge_deformation) tells how
a two qubit gate on both legs of an edge deforms it:

```python
>>> from planqtn.symmetries import (
...     compatible_deformations, edge_deformation, is_symmetry, network_symmetry
... )
>>> [c.name for c in compatible_deformations(Gates.T)]
['X', 'Y', 'XS', 'YS']
>>> [c.name for c in compatible_deformations(Gates.SH)]
['Y', 'XSH', 'YHS']
>>> [c.name for c in compatible_deformations(Gates.K3)]
['Y']
>>> edge_deformation(Gates.CZ)
Gate('Z')

```

[`network_symmetry`](reference.md#planqtn.symmetries.network_symmetry) pushes
symmetries of the LEGOs of a tensor network through its traces, and
[`is_symmetry`](reference.md#planqtn.symmetries.is_symmetry) checks a symmetry
of a signed tensor. The encoding tensor of the [[5,1,3]] code has the symmetry
`(SH)^* ⊗ SH^{⊗5}`, which survives the `|Φ_Y⟩` trace of the network above, but
not a Bell trace:

```python
>>> five_symmetry = [(Gates.SH.conj(), (5,))] + bitwise(Gates.SH, range(5))
>>> symmetries = {"a": five_symmetry, "b": five_symmetry}
>>> y_edge = {(("a", 0), ("b", 0)): Gates.Y}
>>> symmetry = network_symmetry(tn, symmetries, y_edge)
>>> is_symmetry(SignedStabilizerTensor.from_tensor_network(tn, y_edge), symmetry)
True
>>> network_symmetry(tn, symmetries)  # doctest: +ELLIPSIS
Traceback (most recent call last):
...
ValueError: Gate SH on (('a', 0),) and SH on [('b', 0)] don't fix the edge state...

```

## Searching for logical gates

[`search_patterns`](reference.md#planqtn.transversal_search.search_patterns)
tries all placements of gates from a list on groups of legs and returns the ones
that implement logical gates. For diagonal gates the phase polynomials of the
placements are sums of precomputed polynomials, so the search handles millions
of placements. Exactly 2 of the 256 T/T† patterns on the [[8,3,2]] code are the
logical CCZ, and CZs between 15 sets of 7 matching legs of two [[15,1,3]] codes
are a logical CZ (Figure 2c of the paper):

```python
>>> from planqtn.transversal_search import addressable_phase_gates, search_patterns
>>> vertices = [(v,) for v in range(8)]
>>> len(search_patterns(cube, [8, 9, 10], vertices, [Gates.T, Gates.T_DAG], Gates.CCZ))
2
>>> pairs = [(("a", i), ("b", i)) for i in range(15)]
>>> two = [("a", 15), ("b", 15)]
>>> faces = search_patterns(a.tensor_with(b), two, pairs, [None, Gates.CZ], Gates.CZ, weight=7)
>>> len(faces)
15

```

[`addressable_phase_gates`](reference.md#planqtn.transversal_search.addressable_phase_gates)
turns a transversal phase gate into phase gates on the support of a logical X
operator that address a single logical qubit (Proposition 2.7 of the paper). A
bitwise T gate gives addressable S gates (Corollary 2.8):

```python
>>> physical = [leg for leg in x_edge.legs if leg not in two]
>>> for leg, match in addressable_phase_gates(x_edge, two, bitwise(Gates.T, physical)).items():
...     print(leg, [gate.name for gate, _ in match.ops], match.action)
('a', 15) ['S†', 'S†', 'S†', 'S†', 'S†', 'S†', 'S†'] S(a:15)
('b', 15) ['S†', 'S†', 'S†', 'S†', 'S†', 'S†', 'S†'] S(b:15)

```

## Fault tolerance

A single fault before or during a layer of gates can spread to all the qubits of
the gate it hits.
[`analyze_transversality`](reference.md#planqtn.fault_tolerance.analyze_transversality)
reports for blocks of legs whether an operator is strongly or weakly transversal
or localized, how many qubits of each block a single fault can reach, and, given
the distances of the blocks, whether every block can correct the errors of a
single fault.
[`code_distance`](reference.md#planqtn.fault_tolerance.code_distance) computes
small distances by brute force. For the intrablock CZ of the GHZ-joined Steane
codes, every gate touches each branch at most once, but Lemma 3.16 of the paper
needs the shortened codes of the branches, with the traced leg as an additional
logical leg, to have distance 3, and they only have distance 2:

```python
>>> from planqtn.fault_tolerance import (
...     analyze_transversality, blocks_by_tensor_id, code_distance
... )
>>> code_distance(code, logical), code_distance(steane, [7, 0])
(3, 2)
>>> branches = blocks_by_tensor_id([leg for leg in code.legs if leg not in logical])
>>> report = analyze_transversality(cleaning.ops, branches, {name: 2 for name in branches})
>>> report.weakly_transversal, report.max_spread, report.fault_tolerant
(True, 1, False)

```

This only checks how a single fault spreads through the gates. It does not model
faulty syndrome extraction or decoding, nor the located (heralded) errors that
the paper uses for the holographic codes of Section 5.

## Limitations

- Only stabilizer LEGOs and Clifford-deformed traces are supported, not the
  non-isometric traces or the non-stabilizer LEGOs of the paper.
- The diagonal method only finds logical gates that are diagonal in the logical
  computational basis, and operators can't mix non-Clifford gates with
  non-diagonal gates. Phases whose order is not a power of 2 work too, but
  without the bound on the degree of the phase polynomial.
- Cleaning operators are Pauli operators, and only Z-type for diagonal
  operators. Their weight is reduced greedily, not minimized.
- Searches are exhaustive within the given choices, and the derivation of
  addressable gates covers single qubit phase gates (Proposition 2.7), not the
  controlled phase gates of Proposition 2.9.
- These features are not in PlanqTN Studio yet.
