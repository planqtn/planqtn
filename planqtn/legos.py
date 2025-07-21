"""A list of predefined lego types."""

import enum
from typing import Optional

import attrs
import numpy as np
from galois import GF2


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
        STOPPER_X: X-type stopper tensor, the |+> state.
        STOPPER_Z: Z-type stopper tensor, the |0> state.
        STOPPER_Y: Y-type stopper tensor, the |+i> state.
        STOPPER_I: Identity stopper tensor, "free qubit" subspace. Creates subspace legos.
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
    - Encoding tensors for specific quantum codes ([[6,0,3]], [[5,1,2]], etc.)
    - Repetition codes for basic error correction
    - Stopper tensors for terminating tensor networks
    - Identity and Hadamard operations
    - Well-known codes like the Steane code and Quantum Reed-Muller codes

    Example:
        # Get a Z-repetition code with distance 3
        z_rep_matrix = Legos.z_rep_code(d=3)

        # Get the Hadamard tensor
        hadamard_matrix = Legos.h

        # List all available legos
        available_legos = Legos.list_available_legos()
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
        ]
    )
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

        Example:
            # Create a distance-3 Z-repetition code
            matrix = Legos.z_rep_code(d=3)
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

        Example:
            # Create a distance-3 X-repetition code
            matrix = Legos.x_rep_code(d=3)
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

    enconding_tensor_512 = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]
    )

    enconding_tensor_512_x = GF2(
        [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
        ]
    )

    enconding_tensor_512_z = GF2(
        [
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1],
        ]
    )

    h = GF2(
        [
            [1, 0, 0, 1],
            [0, 1, 1, 0],
        ]
    )

    stopper_x = GF2([[1, 0]])
    stopper_z = GF2([[0, 1]])
    stopper_y = GF2([[1, 1]])
    stopper_i = GF2([[0, 0]])
