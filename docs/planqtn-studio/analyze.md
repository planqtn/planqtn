# Analyze tensor networks

Zero installation calculations (studio): PlanqTN Studio is deployed as a cloud
native architecture on Google Cloud and Supabase, and you can run small
calculations for free, forever! See [Runtimes](./runtimes.md) to understand all
the options available.

## Calculate Pauli stabilizers of a tensor network

Select LEGOs and hit Calculate Parity check matrix on the
[Details Panel](./ui-controls.md#details-panel), or the
[Floating toolbar](./ui-controls.md#floating-toolbar).

The
[Parity check matrix widget](./ui-controls.md#the-parity-check-matrix-widget) is
an interactive tool to explore the stabilizer group of the LEGO/tensor network.

## Weight enumerator polynomial calculations

After hitting "Calculate weight enumerator" on either the
[Details Panel](./ui-controls.md#details-panel), or the
[Floating toolbar](./ui-controls.md#floating-toolbar) for a subnet or LEGO, a
screen similar to this will pop up:

<center>
<img src="/docs/fig/wep_calc.png" width="50%">
</center>

This dialog was for the following network:

<center>
<img src="/docs/fig/wep_calc_network.png" width="70%">
</center>

We can see that this subnetwork is part of a larger network. It has 4 dangling
legs and 2 external connections that are leading to LEGOs 3 and 4. The settings
are then going to configure the type of weight enumerator that will be
calculated. If no legs are selected, then no legs are kept open and a scalar
weight enumerator is calculated. Otherwise, a tensor enumerator is calculated
with all possible Pauli operators on the specified open legs.

The WEP calculation allows calculating:

-   Brute force scalar weight enumerator polynomial (WEP) for a single tensor.
-   Tensor WEP for a single tensor with specified open legs.
-   Truncated WEP - only calculate up to a certain weight, this speeds up the
    contraction significantly, making the tensors very sparse
-   MacWilliams dual (normalizer WEP) for scalar WEP
-   Using [Cotengra](https://cotengra.readthedocs.io/) calculate a
    hyper-optimized contraction schedule for any tensor network based on our own
    stabilizer code specific cost function (publication pending).

## Operator pushing and matching

From the
[Parity check matrix widget](./ui-controls.md#the-parity-check-matrix-widget),
one can highlight dangling legs of tensor networks or LEGOs.

-   Highlighting tensor network stabilizer legs (dangling legs).
-   Highlight local stabilizers on individual tensors.

## Export to continue analysis on your computer

The UI might be limiting after a certain size or for certain automated use
cases. PlanqTN makes it easy to transition into Python or other tools.

-   Using the [Canvas menu](./ui-controls.md#canvas-menuexport), one can export
    tensor network as Python code and continue working on it in the PlanqTN
    library.
-   Using the
    [Parity check matrix widget](./ui-controls.md#the-parity-check-matrix-widget),
    export parity check matrices as numpy array, or export parity check matrix
    for `QDistRnd` for distance calculations
