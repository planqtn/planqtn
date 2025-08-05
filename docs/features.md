# Features

At the moment PlanqTN is nascent and has rough edges, a lot more features are
planned including logical operators, non-Pauli symmetries, operator pushing,
more graph state transformations, representing parameterized code families, a
public database to share tensor network constructions and weight enumerators. If
you have more ideas,
[open an issue](https://github.com/planqtn/planqtn/issues/new), we'd love to
hear it!

## Build tensor networks

-   create a tensor network manually from smaller encoding tensors with
    predefined Pauli stabilizers (lib, studio)
-   create a custom LEGO based on parity check matrix (lib, studio)

## Transform tensor networks

-   fuse LEGOs into a single LEGO
-   ZX calculus transformations on Z and X repetition code LEGOs (studio)
    -   fuse rule
    -   bialgebra and inverse bialgebra rule
    -   unfuse:
        -   pull out a leg of the same color
        -   unfuse to legs
        -   unfuse to two LEGOs
    -   change color by adding Hadamard LEGOs on legs
-   Graph state transformations: `Z`-repetition code LEGOs are graph nodes that
    need to be connected through links with a Hadamard LEGO on it (studio)
    -   create complete graph from nodes
    -   connect nodes with a central node
-   "resize" groups of LEGOs - this is reposition based on the bounding box of
    selected LEGOs

## Analyze tensor networks

-   Zero installation calculations (studio): PlanqTN Studio is deployed as a
    cloud native architecture on Google Cloud and Supabase, and you can run
    small calculations for free, forever!
-   Calculate Pauli stabilizers (parity check matrix) of a tensor network (lib,
    studio)
-   calculate coset weight enumerators (lib)
-   weight enumerator polynomial calculations (lib, studio):
    -   brute force scalar weight enumerator polynomial (WEP) for a single
        tensor
    -   tensor WEP for a single tensor with specified open legs
    -   truncated WEP - only calculate up to a certain weight, this speeds up
        the contraction significantly, making the tensors very sparse
    -   MacWilliams dual (normalizer WEP) for scalar WEP
    -   using [Cotengra](https://cotengra.readthedocs.io/) calculate a
        hyper-optimized contraction schedule for any tensor network based on our
        own stabilizer code specific cost function (publication pending)
-   operator pushing and matching (studio)

    -   highlighting tensor network stabilizer legs (dangling legs)
    -   highlight local stabilizers on individual tensors

-   export tensor network as Python code and continue working on it on your own
    computer (studio)
-   export parity check matrices as numpy array (studio)
-   export parity check matrix for `QDistRnd` for distance calculations (studio)
-   run multiple jobs in parallel (studio)
-   local kernel using Docker, with Kubernetes and Supabase to run jobs only
    limited by your resources (studio)
-   undo/redo for all operations (studio)

## Share tensor networks

-   Share/save your canvas as JSON file
-   Share/bookmark your canvas as a URL
