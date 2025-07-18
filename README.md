[![Unitary Foundation](https://img.shields.io/badge/Supported%20By-UNITARY%20FOUNDATION-brightgreen.svg?style=for-the-badge)](https://unitary.foundation)

<p align="center">
<img src="docs/fig/planqtn_logo.png" width="300"></img>
</p>

**Links**

- [planqtn.com](https://planqtn.com): PlanqTN Studio
- [`planqtn` on Pypi](https://pypi.org/planqtn): the official PlanqTN Python library
- [docs.planqtn.com](https://docs.planqtn.com): Documentation for both PlanqTN Studio and the Python library

Welcome to PlanqTN!

PlanqTN is the `planqtn` python library and a [PlanqTN Tensor Studio (https://planqtn.com)](https://planqtn.com), an interactive studio to create, manipulate and analyze tensor network base quantum error correcting codes. The features are an implementation of the [quantum LEGO framework by Charles Cao and Brad Lackey](https://journals.aps.org/prxquantum/abstract/10.1103/PRXQuantum.3.020332) and the [quantum LEGO expansion pack: enumerators from tensor networks by Cao, Gullans, Lackey and Wang](https://journals.aps.org/prxquantum/abstract/10.1103/PRXQuantum.5.030313), but we also integrate with features that automate tensor network contraction with Cotengra and take a unified approach to quantum LEGO, ZX-calculus and graph states. Here's a list of features and whether it's supported in the lib and/or the studio:

- create a tensor network from smaller encoding tensors with predefined Pauli stabilizers (lib, studio)
- create a custom lego based on parity check matrix (lib, studio)
- calculate Pauli stabilizers (parity check matrix) of a tensor network (lib, studio)
- calculate coset weight enumerators (lib)
- tensor network constructions:
  - compass codes
- weight enumerator polynomial calculations (lib, studio):
  - brute force scalar weight enumerator polynomial (WEP) for a single tensor
  - tensor WEP for a single tensor with specified open legs
  - truncated WEP - only calculate up to a certain weight, this speeds up the contraction significantly, making the tensors very sparse
  - MacWilliams dual (normalizer WEP) for scalar WEP
  - using [Cotengra](https://cotengra.readthedocs.io/) calculate a hyperoptimized contraction schedule for any tensornetwork based on our own stabilizer code specific cost function (publication pending)
  - fuse legos into a single lego
- manual operator pushing and matching (studio)
  - highlighting tensor network stabilizer legs (dangling legs)
  - highlight local stabilizers on individual tensors
  - automated Pauli flow highlighting for simple neighboring legos
- ZX calculus transformations on Z and X repetition code legos (studio)
  - fuse rule
  - bialgebra and inverse bialgebra rule
  - unfuse:
    - pull out a leg of the same color
    - unfuse to legs
    - unfuse to two legos
  - change color by adding Hadamard legos on legs
- Graph state transformations - Z-repetition code legos are graph nodes that need to be connected through links with a Hadamard lego on it (studio)
  - create complete graph from nodes
  - connect nodes with a central node
- Zero installation calculations (studio): PlanqTN Studio is ReactJS app deployed on a cloud native architecture using Google Cloud and Supabase, and you can run small calculations for free, forever!
- Other cool PlanqTN Studio only features:
  - an interactive parity check matrix that supports drag and dropping of generators to combine them into new generators, sorting generators by CSS type or stabilizer weight
  - an infinitely sized canvas with zoom and panning
  - resize groups of legos
  - export tensor network as Python code
  - export parity check matrices as numpy array
  - export parity check matrix for qdistrnd for distance calculations
  - run any number of WEP calculation jobs in parallel
  - Share canvases as JSON or as a PlanqTN Studio URL
  - spin up and connect to a local kernel using Docker, with Kubernetes and Supabase to run jobs only limited by your resources
  - monhtly quotas on job and API calls
  - deployment tools and streamlined developer experience - if you want to run your own instance, feel free to do it!

At the moment PlanqTN is nascent and has rough edges, a lot more features are planned including calculating logical operators and their represenatatives, handling non-Pauli symmetries, operator pushing, more graph state and ZX calculus transformations, a visual language representing parameterized code families, a public database to share tensor network constructions and weight enumerators, GPU accelerated WEP calculations and more. If you have more ideas and can't find an existing issue covering it, open an Github issue, we'd love to hear it!

If building tools like this sounds like fun to you, please consider [contributing](#contributing)!

## Getting started with PlanqTN Studio

The idea with PlanqTN Tensor Studio is that you can start to explore the framework via small examples, including calculating weight enumerators and distance for small networks.

As a demo, let's create the [Steane code](https://errorcorrectionzoo.org/c/steane) out of two `[[6,0,3]]` tensors!

1. Navigate to [planqtn.com](https://planqtn.com). No need to register, unless you want to calculate weight enumerators, which we won't need for this tutorial!
2. Grab two pieces of the `[[6,0,3]]` tensors on to the canvas
   <video src="docs/fig/drag_603s.mp4">
3. Connect the two logicals legs and calculate the parity check matrix - we can already see that this is the [[8,0,4]] encoding tensor of the Steane code.
   <video src="docs/fig/steane_tutorial_connect_logicals.mp4">
4. Add in an "identity stopper" to any of the legs to get the subspace parity check matrix
   <video src="docs/fig/steane_tutorial_identity_stopper.mp4">

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

# Contributing

PlanqTN is an open source project and we would love to see contributions from you!

Please consider dropping in for

- our bi-weekly community call (not yet setup)
- our mailing list for development questions (not yet setup)

To get started with contributions, check out [good first issues](https://github.com/planqtn/planqtn/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22), and follow the [DEVELOPMENT.md](./DEVELOPMENT.md) for setup, developer workflows, and design concepts.

# Soft launch preview notice

You are looking at a soft-launch preview of PlanqTN. We are before the v0.1.0 public release, which is scheduled around end of July 2025. Check out the issues for the [milestone](https://github.com/balopat/tnqec/issues?q=is%3Aissue%20state%3Aopen%20milestone%3A%22v0.1%20-%20first%20public%20release%22).

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
