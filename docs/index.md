<img src="fig/planqtn_logo.png" width="20%">

- [planqtn.com](https://planqtn.com): PlanqTN Studio
- [`planqtn` on Pypi](https://pypi.org/planqtn): the official PlanqTN Python library
- [docs.planqtn.com](https://docs.planqtn.com): Documentation for both PlanqTN Studio and the Python library

Welcome to PlanqTN!

PlanqTN is the `planqtn` python library and a [PlanqTN Tensor Studio (https://planqtn.com)](https://planqtn.com), an interactive studio to create, manipulate and analyze tensor network base quantum error correcting codes. The features are an implementation of the [quantum LEGO framework by Charles Cao and Brad Lackey](https://journals.aps.org/prxquantum/abstract/10.1103/PRXQuantum.3.020332) and the [quantum LEGO expansion pack: enumerators from tensor networks by Cao, Gullans, Lackey and Wang](https://journals.aps.org/prxquantum/abstract/10.1103/PRXQuantum.5.030313), but we also integrate with features that automate tensor network contraction with Cotengra and take a unified approach to quantum LEGO, ZX-calculus and graph states.

# Features

Here's a list of features and whether it's supported in the lib and/or the studio:

- create a tensor network from smaller encoding tensors with predefined Pauli stabilizers (lib, studio)
- create a custom lego based on parity check matrix (lib, studio)
- calculate Pauli stabilizers (parity check matrix) of a tensor network (lib, studio)
- calculate coset weight enumerators (lib)
- weight enumerator polynomial calculations (lib, studio):
  - brute force scalar weight enumerator polynomial (WEP) for a single tensor
  - tensor WEP for a single tensor with specified open legs
  - truncated WEP - only calculate up to a certain weight, this speeds up the contraction significantly, making the tensors very sparse
  - MacWilliams dual (normalizer WEP) for scalar WEP
  - using [Cotengra](https://cotengra.readthedocs.io/) calculate a hyperoptimized contraction schedule for any tensornetwork based on our own stabilizer code specific cost function (publication pending)
  - fuse legos into a single lego
- operator pushing and matching (studio)
  - highlighting tensor network stabilizer legs (dangling legs)
  - highlight local stabilizers on individual tensors
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
- Zero installation calculations (studio): PlanqTN Studio is deployed as a cloud native architecture on Google Cloud and Supabase, and you can run small calculations for free, forever!
- Other cool PlanqTN Studio only features:
  - an infinitely sized canvas with zoom and panning
  - resize groups of legos
  - export tensor network as Python code
  - export parity check matrices as numpy array
  - export parity check matrix for qdistrnd for distance calculations
  - run multiple jobs in parallel
  - Share canvases as JSON or URL
  - spin up and connect to a local kernel using Docker, with Kubernetes and Supabase to run jobs only limited by your resources

At the moment PlanqTN is nascent and has rough edges, a lot more features are planned including logical operators, non-Pauli symmetries, operator pushing, more graph state transformations, representing parameterized code families, a public database to share tensor network constructions and weight enumerators. If you have more ideas, open an issue, we'd love to hear it!

If building tools like this sounds like fun to you, please consider [contributing](#contributing)!
Python library:

- Docs: [planqtn library](planqtn/index.md)
- Install: `pip install planqtn`
- Github: [github.com/planqtn/planqtn](https://github.com/planqtn/planqtn)
- on Pypi pypi.org/planqtn Documentation of the Python library `planqtn`

Python Studio:

- Docs: [PlanqTN Studio](planqtn-studio/index.md)
- Site: [planqtn.com](https://planqtn.com)
- Github: [github.com/planqtn/planqtn](https://github.com/planqtn/planqtn)

# Contributing

PlanqTN is an open source project and we would love to see contributions from you!

Please consider dropping in for

- our bi-weekly community call (not yet setup)
- our mailing list for development questions (not yet setup)

To get started with contributions, check out [good first issues](https://github.com/planqtn/planqtn/issues?q=is%3Aissue%20state%3Aopen%20label%3A%22good%20first%20issue%22), and follow the [DEVELOPMENT.md](https://github.com/planqtn/planqtn/blob/main/DEVELOPMENT.md) for setup, developer workflows, and design concepts.
