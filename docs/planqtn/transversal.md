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
  [`logical_action`](reference.md#planqtn.transversal.logical_action).

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

Some logical gates need a cleaning operator next to the transversal part
(Definition 2.5 of the paper), which has to be part of the physical operator.
Three Steane codes joined by a GHZ hyperedge have a CZ between any two logical
qubits, made of CZs between the two blocks and Z gates on the third block
(Figure 9 of the paper):

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
>>> cleaning = bitwise(Gates.Z, [("s2", 2), ("s2", 4), ("s2", 6)])
>>> action = logical_action(code, logical, cz + cleaning)
>>> action.equals([(Gates.CZ, (("s0", 7), ("s1", 7)))])
True

```

## Limitations

- Only stabilizer LEGOs and Clifford-deformed traces are supported, not the
  non-isometric traces or the non-stabilizer LEGOs of the paper.
- The diagonal method enumerates the computational basis support of the tensor,
  which grows exponentially with the number of X-type stabilizers. By default it
  handles supports of up to `2^20` basis states.
- The diagonal method only finds logical gates that are diagonal in the logical
  computational basis.
- Cleaning operators are not searched for, they have to be given.
- These features are not in PlanqTN Studio yet.
