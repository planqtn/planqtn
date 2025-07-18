# Tutorials

## Getting started with PlanqTN Studio

The idea with PlanqTN Tensor Studio is that you can start to explore the framework via small examples, including calculating weight enumerators and distance for small networks.

As a demo, let's create the [Steane code](https://errorcorrectionzoo.org/c/steane) out of two `[[6,0,3]]` tensors!

1. Navigate to [planqtn.com](https://planqtn.com). No need to register, unless you want to calculate weight enumerators, which we won't need for this tutorial!
2. Grab two pieces of the `[[6,0,3]]` tensors on to the canvas
   <video controls="true"> <source src="../fig/drag_603s.mp4" type="video/mp4"> </video>
3. Connect the two logicals legs and calculate the parity check matrix - we can already see that this is the [[8,0,4]] encoding tensor of the Steane code.
   <video controls="true"> <source src="../fig/steane_tutorial_connect_logicals.mp4" type="video/mp4"> </video>
4. Add in an "identity stopper" to any of the legs to get the subspace parity check matrix
   <video controls="true"> <source src="../fig/steane_tutorial_identity_stopper.mp4" type="video/mp4"> </video>

Well done, now you've used the quantum LEGO framework, created a topological code via a generalized concatenation procedure!

## Getting started with PlnanqTN Python Library

1. Create a virtualenv
2. Install `planqtn`

```
pip install planqtn
```

3. Try generating a generic tensor network for any CSS codes and calculating the weight enumerator polynomial for it:

```python
from galois import GF2

from planqtn.codes.compass_code import CompassCodeTN
from planqtn.codes.css_tanner_code import CssTannerCodeTN
from planqtn.progress_reporter import TqdmProgressReporter

hz = GF2(
    [
        [1, 1, 0, 1, 1, 0, 1, 1, 0],
        [0, 1, 1, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1, 0, 1, 1],
    ]
)

hx = GF2(
    [
        [1, 0, 0, 1, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 1, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 1, 0, 0],
        [0, 0, 0, 0, 1, 0, 0, 1, 0],
        [0, 0, 0, 0, 0, 1, 0, 0, 1],
    ]
)

tn = CssTannerCodeTN(hx, hz)

wep = tn.stabilizer_enumerator_polynomial(
    progress_reporter=TqdmProgressReporter(), verbose=False
)
print(wep)

```
