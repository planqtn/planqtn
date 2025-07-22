"""A list of predefined lego types."""

import enum
from typing import Optional

import attrs
import numpy as np
from galois import GF2
from planqtn.pauli import Pauli


class LegoType(enum.Enum):
    """Enumeration of available lego tensor types for quantum error correction.

    This enum defines the different types of tensor "legos" that can be used
    to build quantum error correction codes. Each type represents a different
    stabilizer code or quantum operation with specific properties.

    Attributes:
        H: Hadamard tensor for quantum operations.
        ZREP: Z-type repetition code for bit-flip error correction.
        XREP: X-type repetition code for phase-flip error correction.
        T6: [[6,0,3]] encoding tensor.
        T5: [[5,1,2]] subspace tensor.
        T5X: X-component of [[5,1,2]] tensor.
        T5Z: Z-component of [[5,1,2]] tensor.
        STOPPER_X: X-type stopper tensor, the |+> state, the Pauli X operator.
        STOPPER_Z: Z-type stopper tensor, the |0> state, the Pauli Z operator.
        STOPPER_Y: Y-type stopper tensor, the |+i> state, the Pauli Y operator.
        STOPPER_I: Identity stopper tensor, "free qubit" subspace. Creates subspace legos, Pauli I.
        ID: Identity tensor, or the Bell-state.
    """

    H = "h"
    ZREP = "z_rep_code"
    XREP = "x_rep_code"
    T6 = "t6"
    T5 = "t5"
    T5X = "t5x"
    T5Z = "t5z"
    STOPPER_X = "stopper_x"
    STOPPER_Z = "stopper_z"
    STOPPER_Y = "stopper_y"
    STOPPER_I = "stopper_i"
    ID = "identity"


@attrs.define
class LegoAnnotation:
    """Annotation data for lego tensor visualization and identification.

    This class stores metadata about lego tensors, including their type,
    position for visualization, and descriptive information.

    Attributes:
        type: The type of lego tensor (from LegoType enum).
        x: X-coordinate for visualization (optional).
        y: Y-coordinate for visualization (optional).
        description: Detailed description of the tensor (optional).
        name: Full name of the tensor (optional).
        short_name: Abbreviated name for display (optional).
    """

    type: LegoType
    x: Optional[float] = None
    y: Optional[float] = None
    description: Optional[str] = None
    name: Optional[str] = None
    short_name: Optional[str] = None


class Legos:
    """Collection of predefined quantum error correction tensor "legos".

    This class provides a library of pre-defined stabilizer code tensors
    and quantum operations that can be used as building blocks for quantum
    error correction codes. Each lego represents a specific quantum code
    or operation with its associated parity check matrix.

    The class includes various types of tensors:

    - Encoding tensors for specific quantum codes (`[[6,0,3]]`, `[[5,1,2]]`, etc.)
    - Repetition codes for basic error correction
    - Stopper tensors for terminating tensor networks
    - Identity and Hadamard operations
    - Well-known codes like the Steane code and Quantum Reed-Muller codes

    Example:
        ```python
        >>> from planqtn.symplectic import sprint
        >>> # Get the Hadamard tensor
        >>> Legos.h
        GF([[1, 0, 0, 1],
            [0, 1, 1, 0]], order=2)
        >>> # Get the stopper_x tensor
        >>> Legos.stopper_x
        GF([[1, 0]], order=2)
        >>> # Get the stopper_z tensor
        >>> Legos.stopper_z
        GF([[0, 1]], order=2)
        >>> # Get a Z-repetition code with distance 3
        >>> # and print it in a nice symplectic format
        >>> sprint(Legos.z_rep_code(d=3))
        ___|11_
        ___|_11
        111|___

        ```
    """

    enconding_tensor_603 = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0],
            [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1],
        ]
    )

    stab_code_parity_422 = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1],
        ]
    )

    # fmt: off
    steane_code_813_encoding_tensor = GF2([
        [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]
    ])
    # fmt: on

    @staticmethod
    def z_rep_code(d: int = 3) -> GF2:
        """Generate a Z-type repetition code parity check matrix.

        Creates a repetition code that protects against bit-flip errors using
        Z-type stabilizers. The code has distance d and encodes 1 logical qubit
        in d physical qubits. It is also the Z-spider in the ZX-calculus.

        Args:
            d: Distance of the repetition code (default: 3).

        Returns:
            GF2: Parity check matrix for the Z-repetition code.
        """
        gens = []
        for i in range(d - 1):
            g = GF2.Zeros(2 * d)
            g[[d + i, d + i + 1]] = 1
            gens.append(g)
        g = GF2.Zeros(2 * d)
        g[np.arange(d)] = 1
        gens.append(g)
        return GF2(gens)

    @staticmethod
    def x_rep_code(d: int = 3) -> GF2:
        """Generate an X-type repetition code parity check matrix.

        Creates a repetition code that protects against phase-flip errors using
        X-type stabilizers. The code has distance d and encodes 1 logical qubit
        in d physical qubits. It is also the X-spider in the ZX-calculus.

        Args:
            d: Distance of the repetition code (default: 3).

        Returns:
            GF2: Parity check matrix for the X-repetition code.
        """
        gens = []
        for i in range(d - 1):
            g = GF2.Zeros(2 * d)
            g[[i, i + 1]] = 1
            gens.append(g)
        g = GF2.Zeros(2 * d)
        g[np.arange(d, 2 * d)] = 1
        gens.append(g)
        return GF2(gens)

    identity = GF2(
        [
            [1, 1, 0, 0],
            [0, 0, 1, 1],
        ]
    )
    """the identity tensor is the Bell state, the |00> + |11> state"""

    encoding_tensor_512 = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]
    )
    """the [[5,1,2]] subspace tensor of the [[4,2,2]] code, i.e. with the logical leg, leg 5 traced
    out with the identity stopper from the [[6,0,3]] encoding tensor."""

    encoding_tensor_512_x = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
        ]
    )
    """the X-only version of the [planqtn.Legos.encoding_tensor_512][]"""

    encoding_tensor_512_z = GF2(
        [
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]
    )
    """the Z-only version of the [planqtn.Legos.encoding_tensor_512][]"""

    h = GF2(
        [
            [1, 0, 0, 1],
            [0, 1, 1, 0],
        ]
    )
    """the Hadamard tensor"""

    stopper_x = GF2([Pauli.X.to_gf2()])
    """the X-type stopper tensor, the |+> state, corresponds to the Pauli X operator."""

    stopper_z = GF2([Pauli.Z.to_gf2()])
    """the Z-type stopper tensor, the |0> state, corresponds to the Pauli Z operator."""

    stopper_y = GF2([Pauli.Y.to_gf2()])
    """the Y-type stopper tensor, the |+i> state, corresponds to the Pauli Y operator."""

    stopper_i = GF2([Pauli.I.to_gf2()])
    """the identity stopper tensor, which is the free qubit subspace, corresponds to the
    Pauli I operator."""
