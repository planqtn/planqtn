[![Unitary Foundation](https://img.shields.io/badge/Supported%20By-UNITARY%20FOUNDATION-brightgreen.svg?style=for-the-badge)](https://unitary.foundation)

<p align="center">
<img src="fig/planqtn_logo.png" width="300"></img>
</p>

Welcome to the PlanqTN!

PlanqTN is the `planqtn` python library and a [PlanqTN Tensor Studio (https://planqtn.com)](https://planqtn.com), an interactive studio to create, manipulate and analyze tensor network base quantum error correcting codes. The features are an implementation of the [quantum LEGO framework by Charles Cao and Brad Lackey](https://journals.aps.org/prxquantum/abstract/10.1103/PRXQuantum.3.020332) and the [quantum LEGO expansion pack: enumerators from tensor networks by Cao, Gullans, Lackey and Wang](https://journals.aps.org/prxquantum/abstract/10.1103/PRXQuantum.5.030313).

## Getting started

The idea with PlanqTN Tensor Studio is that you can start to explore the framework via small examples, including calculating weight enumerators and distance for small networks.

If you want to get started with the Python library then simply

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

# Tutorials

If you want to go deeper, check out these tutorials to get started:

1. What is tensornetwork quantum error correction? (TODO: video)
2. Follow the getting started started Notebook for the `planqtn` Python library (TODO)

# Advanced workflows

If you want to go beyond the small examples and start to explore even beyond what's available on the public instance of PlanqtTN Tensor Studio, we do have options for you:

1. You can generate Python code to take out (TODO: link) your constructed code, and can immediately start to use it in `planqtn`
2. You can spin up your own local kernel using your own resources with the UI (TODO: documentation)

# Contributing

PlanqTN is an open source project and we would love to see contributions from you!

Please consider dropping in for

- our bi-weekly community call (TODO)
- our mailing list for development questions (TODO)

To get started with contributions, check out [good first issues](https://github.com/planqtn/planqtn/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22), and follow the [DEVELOPMENT.md](./DEVELOPMENT.md) for setup, developer workflows, and design concepts.

# Private preview notice

You are looking at a private preview of PlanqTN. We are before the v0.1.0 public release, which is scheduled around mid-July 2025. Check out the issues for the [milestone](https://github.com/balopat/tnqec/issues?q=is%3Aissue%20state%3Aopen%20milestone%3A%22v0.1%20-%20first%20public%20release%22).

The project has the following main parts:

1. PlanqTN library for weight enumerators, under the [qlego](./qlego) folder
2. the PlanqTN Tensor Studio under [app](./app) folder

!WARNING!

There are many breaking changes expected in the library and the app, including significant design changes. Exciting times!

### Install instructions for the qlego library only

!WARNING! this will change soon the planqtn! + we'll publish to PyPi.

# License

Copyright 2025 Balint Pato

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
