# Analyze tensor networks

!!! warning

    Under construction [TODO: expand all these bulletpoints]

Zero installation calculations (studio): PlanqTN Studio is deployed as a cloud
native architecture on Google Cloud and Supabase, and you can run small
calculations for free, forever!

## Calculate Pauli stabilizers (parity check matrix) of a tensor network

Select legos and hit Calculate Parity check matrix.

## Weight enumerator polynomial calculations

-   brute force scalar weight enumerator polynomial (WEP) for a single tensor
-   tensor WEP for a single tensor with specified open legs
-   truncated WEP - only calculate up to a certain weight, this speeds up the
    contraction significantly, making the tensors very sparse
-   MacWilliams dual (normalizer WEP) for scalar WEP
-   using [Cotengra](https://cotengra.readthedocs.io/) calculate a
    hyperoptimized contraction schedule for any tensornetwork based on our own
    stabilizer code specific cost function (publication pending)

## Operator pushing and matching

-   highlighting tensor network stabilizer legs (dangling legs)
-   highlight local stabilizers on individual tensors

## Export to continue analysis on your computer

-   export tensor network as Python code and contine working on it on your own
    computer
-   export parity check matrices as numpy array
-   export parity check matrix for `QDistRnd` for distance calculations
-   run multiple jobs in parallel

## Calculating the distance of a code

1. Calculate parity check matrix
2. Export in qdistrnd format
3. run it in GAP / GUAVA
