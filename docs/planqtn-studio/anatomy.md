# The anatomy of a quantum LEGO

<center>
<img src="/docs/fig/lego.png" width="50%">
</center>

A quantum LEGO has the following pieces in PlanqTN:

-   a body that might be a generic or special design (see
    [Predefined tensors](./build.md#predefined-tensors) for a detailed list of
    them)
-   an instance ID (12 in the figure above) - an integer in the UI, though the
    [TensorId](../planqtn/reference.md#planqtn.stabilizer_tensor_enumerator.TensorId)
    is a richer object in the PlanqTN Python library
-   a short name (T6 in the figure above) - this can be changed in the
    [Details panel](./ui-controls.md#details-panel) or the
    [Floating subnet toolbar](./ui-controls.md#floating-toolbar)
-   physical legs with leg labels (legs 0, 1, 2, 3 in the figure)
-   logical legs with leg labels (legs 4 and 5 in the figure) - these are
    clickable for highlighting
-   Pauli highlights - gray/no highlights for I, red for X, blue for Z and
    purple for Y operators

One can hide or show any of these details by changing the
[Canvas menu > display settings](./ui-controls.md#canvas-menudisplay-settings)
options.
