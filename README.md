# Quantum Lego for weight enumerators 

Quick start: 

1. Create a virtualenv
2. Install qlego 
```
pip install -e . 
```
3. Try it: 

```python
from galois import GF2

from qlego.codes.compass_code import CompassCodeTN
from qlego.codes.css_tanner_code import CssTannerCodeTN

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

wep = tn.stabilizer_enumerator_polynomial(progress_bar=True, verbose=False)
print(weps)
```
