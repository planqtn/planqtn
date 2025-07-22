# Getting started with the PlanqTN Python API

1. Create a virtualenv
2. Install `planqtn`

```
pip install planqtn
```

3. Generating a universal network for any CSS code and calculating the weight
   enumerator polynomial for it:

```python
>>> from galois import GF2
>>> from planqtn.networks import StabilizerTannerCodeTN
>>> h_5qubit = GF2([
... [1, 0, 0, 1, 0, 0, 1, 1, 0, 0],
... [1, 0, 1, 0, 0, 0, 0, 0, 1, 1],
... [0, 0, 1, 0, 1, 1, 1, 0, 0, 0],
... [0, 1, 0, 0, 1, 0, 0, 1, 1, 0]
... ])
>>> tn = StabilizerTannerCodeTN(h_5qubit)
>>> tn.stabilizer_enumerator_polynomial()
UnivariatePoly({0: 1, 4: 15})

```
