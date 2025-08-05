"""The starting point for PlanqTN Python API is the `planqtn` package.

PlanqTN is a library for creating and analyzing tensor network quantum error correction codes.

To build tensor network codes manually, use the [planqtn.TensorNetwork][] class and
the [planqtn.StabilizerCodeTensorEnumerator][] class for nodes alongside with the [planqtn.Legos][]
module for predefined parity check matrices.


Example:
    Put together a tensor network from stabilizer code tensors and compute the weight
    enumerator polynomial.

    ```python
    >>> from planqtn import TensorNetwork
    >>> from planqtn import StabilizerCodeTensorEnumerator
    >>> from planqtn import Legos
    >>> # Create tensor network from stabilizer code tensors
    >>> nodes = [StabilizerCodeTensorEnumerator(tensor_id="z0", h=Legos.z_rep_code(3)),
    ...          StabilizerCodeTensorEnumerator(tensor_id="x1", h=Legos.x_rep_code(3)),
    ...          StabilizerCodeTensorEnumerator(tensor_id="z2", h=Legos.z_rep_code(3))]
    >>> tn = TensorNetwork(nodes)
    >>> # Add traces to define contraction pattern
    >>> tn.self_trace("z0", "x1", [0], [0])
    >>> tn.self_trace("x1", "z2", [1], [0])
    >>> # Compute weight enumerator polynomial
    >>> wep = tn.stabilizer_enumerator_polynomial()
    >>> print(wep)
    {0:1, 2:2, 3:8, 4:13, 5:8}

    ```

To build tensor network codes automatically, you can use classes in the [planqtn.networks][] module,
which contain universal tensor network layouts for stabilizer codes as well for specific codes.

Example:
    Generate the tensor network for the 5x5 rotated surface code and calculate the weight
    enumerator polynomial.

    ```python
    >>> from planqtn.networks import RotatedSurfaceCodeTN
    >>> tn = RotatedSurfaceCodeTN(5)
    >>> for power, coeff in tn.stabilizer_enumerator_polynomial().items():
    ...     print(f"{power}: {coeff}")
    0: 1
    2: 8
    4: 72
    6: 534
    8: 3715
    10: 25816
    12: 158448
    14: 782532
    16: 2726047
    18: 5115376
    20: 5136632
    22: 2437206
    24: 390829

    ```


"""

from planqtn.tensor_network import TensorNetwork
from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.poly import UnivariatePoly
from planqtn.legos import Legos

__all__ = [
    "TensorNetwork",
    "TensorId",
    "TensorLeg",
    "StabilizerCodeTensorEnumerator",
    "Legos",
    "UnivariatePoly",
]
