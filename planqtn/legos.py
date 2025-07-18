import enum
from galois import GF2
import numpy as np
from typing import List, Dict, Any, Optional
import attrs


class LegoType(enum.Enum):
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
    type: LegoType
    x: Optional[float] = None
    y: Optional[float] = None
    description: Optional[str] = None
    name: Optional[str] = None
    short_name: Optional[str] = None


class Legos:

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

    @classmethod
    def list_available_legos(cls) -> List[Dict[str, Any]]:
        """Returns a list of all available lego pieces with their descriptions."""
        legos = [
            {
                "id": LegoType.T6.value,
                "name": "[[6,0,3]] tensor",
                "short_name": "T6",
                "description": "[[6,0,3]] encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_603.tolist(),
                "logical_legs": [4, 5],
                "gauge_legs": [],
            },
            {
                "id": LegoType.T5.value,
                "name": "[[5,1,2]] tensor",
                "short_name": "T5",
                "description": "[[5,1,2]] encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_512.tolist(),
                "logical_legs": [4],
                "gauge_legs": [],
            },
            {
                "id": LegoType.H.value,
                "name": "Hadamard",
                "short_name": "H",
                "description": "Hadamard tensor",
                "parity_check_matrix": cls.h.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.STOPPER_X.value,
                "name": "X Stopper",
                "short_name": "X",
                "description": "X-type stopper tensor",
                "parity_check_matrix": cls.stopper_x.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.STOPPER_Z.value,
                "name": "Z Stopper",
                "short_name": "Z",
                "description": "Z-type stopper tensor",
                "parity_check_matrix": cls.stopper_z.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.STOPPER_I.value,
                "name": "Identity Stopper",
                "short_name": "I",
                "description": "Identity stopper tensor",
                "parity_check_matrix": cls.stopper_i.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.ZREP.value,
                "name": "Z-Repetition Code",
                "short_name": "ZREP3",
                "description": "Bitflip code, ZZ stabilizers",
                "is_dynamic": True,
                "parameters": {"d": 3},
                "parity_check_matrix": cls.z_rep_code().tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.XREP.value,
                "name": "X-Repetition Code",
                "short_name": "XREP3",
                "description": "Phase flip code, XX stabilizers",
                "is_dynamic": True,
                "parameters": {"d": 3},
                "parity_check_matrix": cls.x_rep_code().tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.ID.value,
                "name": "Identity",
                "short_name": "I",
                "description": "Identity tensor",
                "parity_check_matrix": cls.identity.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": "steane",
                "name": "Steane Code",
                "short_name": "STN",
                "description": "Steane code encoding tensor",
                # fmt: off
                "parity_check_matrix": cls.steane_code_813_encoding_tensor.tolist(),
                # fmt: on
                "logical_legs": [7],
                "gauge_legs": [],
            },
            {
                "id": "832",
                "name": "[[8,3,2]] encoding tensor",
                "short_name": "[[8,3,2]]",
                "description": "[[8,3,2]] encoding tensor with all 3 logical legs",
                # fmt: off
                "parity_check_matrix": np.array([
                    [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1]
                ]).tolist(),
                # fmt: on
                "logical_legs": [8, 9, 10],
                "gauge_legs": [],
            },
            {
                "id": "15qrm",
                "name": "[[15,1,3]] QRM encoding tensor",
                "short_name": "QRM15",
                "description": "[[15,1,3]] Quantum Reed-Muller code encoding tensor",
                # fmt: off
                "parity_check_matrix":  np.array([
                        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
                        [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1]
                    ]).tolist(),
                # fmt: on
                "logical_legs": [15],
                "gauge_legs": [],
            },
        ]

        return legos
