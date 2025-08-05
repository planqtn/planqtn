# Build tensor networks

PlanqTN Studio provides [Predefined tensors](#predefined-tensors),
[Custom tensors](#creating-custom-tensors) and
[Automated network layouts](#automated-network-layouts). to use for building
tensor networks. We suggest starting with mastering
[Basic canvas interactions](#basic-canvas-interactions) first, and then
exploring all the building blocks.

## Basic canvas interactions

-   **Dragging LEGOs**: The user can add a LEGO to the canvas by dragging it
    from the [Building blocks panel](./ui-controls.md#building-blocks-panel).
-   **Selecting LEGOs**:
    -   clicking on a LEGO selects it, details of the LEGO can be viewed in the
        [Details panel](./ui-controls.md#details-panel)
    -   click and drag on the canvas, will start the selection box, covered
        LEGOs are selected
    -   Shift + click adds to/removes from the active the selection
    -   Clicking on a selected LEGO selects the connected component of that
        LEGO - very useful for selecting tensor networks
-   **Cloning LEGOs**:
    -   Shift + mouse drag will clone a LEGO or a selected set of LEGOs
    -   selected LEGOs can be copy-pasted as well, after hitting Ctrl+C (Cmd+C
        on MacOSX) and pointing the mouse to the desired location on the canvas,
        Cltr+V (Cmd+V) will paste the content to the canvas. This works across
        different tabs as well.

## Predefined tensors

The following are the categories of predefined tensors:

-   Rank-1 tensors which are basically states or subspaces called "stoppers".
-   The rank-2 (two legged) tensors.
-   Dynamic Z/X tensors.
-   The [[4,2,2]] code's encoding tensor and its variants.
-   Other higher rank tensors.

### Stoppers

There are three types of stoppers:

-   The X Stopper: this is the plus state, stabilized by the Pauli X operator.
    When traced with a leg, it only preserves the stabilizers that have identity
    or the Pauli X on that leg.
-   The Z Stopper: this is the zero state, stabilized by the Pauli Z operator.
    When traced with a leg, it only preserves the stabilizers that are identity
    or Pauli Z on that leg.
-   The Identity Stopper: this is the "free qubit", represents a two-dimensional
    subspace, and it is not stabilized by any of the Pauli operators. This is
    the main tool to represent subspaces in the quantum LEGO framework, and
    PlanqTN is the first to represent it this way. When traced with a leg, it
    only preserves the stabilizers that are identity on that leg.

<center>
<img src="/docs/fig/stoppers.png" width="50%">
</center>

!!! tip

    Cool trick: You can drop an stopper on any leg directly and it will connect to it

### Rank-2 tensors

The rank-2 (two-legged) tensors are:

-   The Hadamard operator: when this tensor is traced with a leg, the
    stabilizers of the network on that leg are converted, Pauli X operators on
    that leg become Pauli Z operators and vice versa.
-   The identity operator: this is the Bell state, which is just a wire
    technically, it has no effect, however, it is useful sometimes to explicitly
    denote visually a location.
-   X and Z repetition code with distance parameter `d=2` - these are also just
    equal to the identity operator, but the user can do ZX calculus
    transformations on them (e.g. pull out a leg of same color)

<center>
<img src="/docs/fig/rank-2-LEGOs.png" width="50%">
</center>

!!! tip

    Cool trick: You can drop an rank-2 tensor on any connection directly and it will inject itself between the two LEGOs.

### Dynamic X/Z tensors

These are the repetition codes, and are also completely equivalent definitions
to the X and Z spiders in ZX calculus.

<center>
<img src="/docs/fig/zx-LEGOs.png" width="50%">
</center>

When these LEGOs are dragged on the canvas, the distance can be entered and a
LEGO with that many legs will be created.

### The [[4,2,2]] code LEGOs

The [[4,2,2]] code plays a special role as it was the first LEGO to describe the
surface code, the toric code, the rotated surface code, Bacon-Shor codes. These
codes leverage the hand-built SVG design capability of PlanqTN (see
[source](https://github.com/planqtn/planqtn/tree/main/app/ui/src/features/LEGO/svg-LEGOs))
to follow closely the original paper's intuitive design.

<center>
<img src="/docs/fig/422_code_tensors.png" width="50%">
</center>

!!! note

    Note that the [[5,1,2]] subspace tensor is equivalent to having the
    [[6,0,3]] tensor with leg 5 traced with an Identity Stopper.

### Other high-rank tensors

We also provide the generic design version of some higher rank examples:

-   the [Steane code](https://errorcorrectionzoo.org/c/steane)
-   the
    [smallest interesting color code [[8,3,2]]](https://errorcorrectionzoo.org/c/stab_8_3_2)
-   the [[[15,1,3]] Quantum Reed-Muller
    code](https://errorcorrectionzoo.org/c/stab_15_1_3)

<center>
<img src="/docs/fig/high-rank-tensors.png" width="50%">
</center>

Unique designs for these, similar to the [[4,2,2]] code variants are a
possibility, if you're interested to contribute, please reach out!

## Creating custom tensors

Creating a custom LEGO is as easy as providing the parity check matrix and
specifying the logical legs after dragging the custom LEGO to the canvas:

<center>
<img src="/docs/fig/custom-LEGO.png" width="50%">
</center>

## Automated network layouts

### CSS Tanner Layout

This tensor network layout compiles a parity check matrix for a CSS stabilizer
code into a layout as defined in Fig 6 of the following work:

    Cao, ChunJun, Michael J. Gullans, Brad Lackey, and Zitao Wang. 2024.
    “Quantum LEGO Expansion Pack: Enumerators from Tensor Networks.”
    PRX Quantum 5 (3): 030313. https://doi.org/10.1103/PRXQuantum.5.030313.

For example, for the [[4,2,2]] code the user would enter:

```
XXXX
ZZZZ
```

<center>
<img src="/docs/fig/css_tanner_network_dialog.png" width="50%">
</center>

And after a couple of seconds, calling into a backend API running the
[CssTannerCodeTN](../planqtn/reference.md#planqtn.networks.CssTannerCodeTN)
Python class, it generates the following one:

<center>
<img src="/docs/fig/422_css_network.png" width="50%">
<p>
<a target="blank" href="/#state=NoImwFgGgJlhdeACAxgewCYFMRXCAZwBc0AHUrAJwH0BLXEARlwFoBWNgBli6hFJQBbap1wA7AK4AbKVEky+AR04A6WhhDw8IABYMYrCLxi9+Q6sznTZ82SGUqdoraAAe1SllLV02BgGZWf2NTAWEDKwVbJVUAL01tPT4IVhNuNL4wi3FrSLsHHWYXEHdPb18cPjZWRhDuM3CcqNz7VVcE0GIyChp6PgA2VjrM81E88ftGNQ1ipJAAdlxhhuzx6MnHZ21Srx9MSpAADlxa9NDzCOj1xSn42YYATlwMjJXLK5abxyLtj12KhiMMbBM71LKXXLXKbtYpdchUOiAyxGUEjYRjD4KewwaYdXSAiIcVFvJo2T44px4nblfaAwJQfrLcGkiaKHF3RKAlJQeZM8zvSHk75Uv40vx8Wq4Q58xprIUw7RwnqIiWDKAPGUiFnXfy4+4SxZQIGagXNLGKXWU4rUvbipjHI2nHhgi7az66jmgOaMJ5Gl7nYSmsnmy0-Nyi20HGBjRgg51o6gQs35XUK0CxCMAvgwZGcbgQPMJ+mYuyuLbpzO07MRAvcIEu4TFwVY2LOFygSz1CKcYoRRh8ek97Tc+r0xjFbn9kDVKBD0Bq+qGucLE58B3L331B3j7S+qdA3DLxidiXd4qMPsSwfnkdXk431dMGdHhcGw-nw379fnzcS7c-x9o3fbQc0PKpnl7Sx9zGGBIOeCUZ1gkDLH8bMYN7bsBwgkDLyObDQBgCI4CYekkIIiJUPtCCtHmPBahgQ4oEOGBUNURk2CgFh5n6XUIDgFhozYFQ2HmdsVjGcBuB7RBtCySxwH7KSjRcOsjVnRBimZPBgH7RTZ30udVL0qSVIMtTdI02TzHpSSzKMgzTKUpTdPUvAnLs8yXBclz3OkmSSzlGR4CAA">Open in canvas</a>
</p>
</center>

Note that it is possible to enter the parity check matrix via symplectic form -
even with extra characters like commas and parentheses, the UI will filter those
out automatically:

<center>
<img src="/docs/fig/css_tanner_symplectic.png" width="50%">
</center>

### Tanner Layout

The Tanner layout is the generalization of the CSS Tanner layout to arbitrary
stabilizer codes, and a such it is a universal stabilizer code layout based on

```
Cao, ChunJun, Michael J. Gullans, Brad Lackey, and Zitao Wang. 2024.
“Quantum LEGO Expansion Pack: Enumerators from Tensor Networks.”
PRX Quantum 5 (3): 030313. https://doi.org/10.1103/PRXQuantum.5.030313.
```

For the [5-qubit code](https://errorcorrectionzoo.org/c/stab_5_1_3) with
stabilizers:

```
XZZXI
IXZZX
XIXZZ
ZXIXZ
```

We get the following diagram, where the 5 qubit nodes implicitly contain the
logical leg and the 4 stabilizer generators are represented by the red bit flip
code LEGOs:

<center>
<img src="/docs/fig/5qubit.png" width="50%">
<p>
<a target="blank" href="/#state=NoIgrABAjgrgRgSwC4QMYHsAmBTEAaYUAc2wDtsAnBVfEARnwBYBORvAZkYA48QAHVAFsA+gAZ8pGABspeSTN5RxAXQIgS5KjV4AmfGFYduvASIZzps+bJBQGq4mUrVa7fADZDnHvyHC9FgrWinoO6k5atIz4AOxexr4iboFWlopuYRrO2uD4XPE+psLRKaW20WEAXsIU2HzCGDi07vqMbHTMhX5gEmnBIKgAFtioANYqatW19Y24vDEebXgdXSI9pf1DI6P2kzV1DVhzIFyxSysm3b1BaQPDY6F704dNvMx5552Xa9epCnfbDIOUDmUS8Fp4URhcx0XinSHQ-DsN74KFqAJgkAQuhhAKwkALBHo-A6FHLMLJTEQnQU-D4wk4tTJUknOlhEpUpHsunzEncvAs+E0tQlZEgd4CsLrTGE9hSnmsjjyjhkuWqGIEOhgHQ8Lg6ZGiAB0XHcPAAtO5GIadGA8Gb2FxrWBgYkxPhCLCwZ7IT6vQ4wQHlr6g2jgF6Q8G-cowkVzIRwwnIw5vYHw7DGWGfenIwjo2oigEPTnA+n-VmI6myyng6W86Aiski6mI9mA1XizXyQRm63i2XE8209GY34Sk2Ky3++WS0TM9WZ1C6671kXs-PZ4OJxnNzPtx3vTjhxs+ieZMogA">Open in canvas</a>
</p>
</center>

We note that these universal layouts have very poor performance when it comes to
weight enumerator calculations, but they can be very useful starting points for
deriving more coarse grained layouts.

### Measurement State Preparation Layout

The Measurement State Prep (MSP) layout is a universal layout defined in

```
Cao, ChunJun, Michael J. Gullans, Brad Lackey, and Zitao Wang. 2024.
“Quantum LEGO Expansion Pack: Enumerators from Tensor Networks.”
PRX Quantum 5 (3): 030313. https://doi.org/10.1103/PRXQuantum.5.030313.
```

Our example is the [[4,1,2]] code, which can be seen as the 2x2
[rotated surface code](https://errorcorrectionzoo.org/c/rotated_surface) with
stabilizer generators:

```
XXXX
ZZII
IIZZ
```

The following is the diagram:

<center>

<img src="/docs/fig/412_msp.png" width="50%">
<p><a target="blank" href="/#state=NoImwFgGgRigmAuogBAYwPYBMCmKCyAygAooB2OALgO4YBOA1iFOCAM6UYAOXOdA+gEtmIGMwgwA7LAAM8KCC5oAtvxnMyAVwA22qFt0KAjtvWIW7Tjz5CR8cVKgBmAGwyAdBBcKlq9fp09Az0QEzFzUA5uXgFhBScHaRcYAA53AE55RRU1DUCAw1DtewjLaJs4kAhEqBTJSXcndJ8c-2CCkJME0oAvfjocLn5MXBEAVmYXSTHPbwBaGDGXWZbVMQ6NkDQACxw0BjMLPoGhkZwRF2Z0pycM+QWllezVew32rd398KP+weHsc4KSTMGAwTKNZoPZZeVb8V7td47PYMEoWAAev1OAJEKUm0xWMDksISb3yoQ8aMOoGOfzOInSVxud1kWV8-GqpMKRg8PW+oG2IkJjNumSgc3gDXgTlhE05nQ8215IFKGJO-1GClBeJmMNcHhhz34JIRZKMMHclOVPzVdM1r2uIvkeqebI5Jq55qVpQFmpJDuZUvNUpleUM7zN7kVfJAqtp2M1HKmOu8yTSosNxvy4fgFqpIBpWI1olloPBTSgqeZhrdWdNOZ6qP5gsusDBOfLEBS6XcLmahtl7s6OcVjZjmPVgNEwIr+JhdQa5YzoaCptult649tolxrbLzXnENhNbDq-cDatTc1DN37eakk77hg3n7y82RluI4vZWsAjRdn8yQeCkYxios0LPmyLaDgoGIcAAhpQOD8FwJx5lEP78H+CjwOs94eDIKSgY8BqQa+7wYsoOBwWwaFWDEmF2K8KS9o0cBQi6ORQbWhSwZQCFIShgzRuh9FYSAUpXOkaRjNA7EkZxZFkhRVFsMJdE2GJ8AcqCEruPURHgbCXEnjx-DwYhyEnKOIkaXYJbwGM0hyRBClyjB-CUdRJQRKA8D+DICiyjIpQ4cwAUgCWIWvOFLbBRYElQDFIIhRy4XTnFvlBUCyUWOs4U7hlIA7nAEXMEgFg7lk16FdeJVColpT1SVLblb5YWanljXrCVspOF1ZV2mFjWvHVJKFTAJLNcwfUWGNCZDbl2mBeIjUclkiwLaAG2wJqsWNS2JXTq1VTtVOm1nTtpVQGMjVHZqBWNcVV7nWCILZc4yA7cAizwIRKTBh4YyOHMYxOOaYwgXMrgQO4KQQD5hr+OAAXBZ9oBsusyOJdjKPY3AcC4yjESEzjpP46TGUk1TeM7UTLDUwzO0E8TFOsyT+MROTXO02zDVo4arxY+zPOU7z5Oi4zHMsNzBMU8gpRsiS4Di3L9NM6rwDCxz-OuswQs08zata5z6uE-LFhsrKytkyz4vm+jrnW6jn3QYOiBAA">Open in canvas</a></p>

</center>
