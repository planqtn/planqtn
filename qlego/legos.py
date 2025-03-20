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


@attrs.define
class LegoAnnotation:
    type: LegoType
    x: Optional[float] = None
    y: Optional[float] = None
    description: Optional[str] = None
    name: Optional[str] = None
    shortName: Optional[str] = None


class Legos:

    enconding_tensor_602 = GF2(
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

    def z_rep_code(d=3):
        gens = []
        for i in range(d - 1):
            g = GF2.Zeros(2 * d)
            g[[d + i, d + i + 1]] = 1
            gens.append(g)
        g = GF2.Zeros(2 * d)
        g[np.arange(d)] = 1
        gens.append(g)
        return GF2(gens)

    def x_rep_code(d=3):
        gens = []
        for i in range(d - 1):
            g = GF2.Zeros(2 * d)
            g[[i, i + 1]] = 1
            gens.append(g)
        g = GF2.Zeros(2 * d)
        g[np.arange(d, 2 * d)] = 1
        gens.append(g)
        return GF2(gens)

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
                "name": "Encoding Tensor 6-0-2",
                "shortName": "T6",
                "description": "[[6,0,2]] encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_602.tolist(),
                "logical_legs": [4, 5],
                "gauge_legs": [],
            },
            {
                "id": LegoType.T5.value,
                "name": "Encoding Tensor 5-1-2",
                "shortName": "T5",
                "description": "[[5,1,2]] encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_512.tolist(),
                "logical_legs": [4],
                "gauge_legs": [],
            },
            {
                "id": LegoType.T5X.value,
                "name": "Encoding Tensor 5-1-2 X",
                "shortName": "ET51X",
                "description": "X component of 5-1-2 encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_512_x.tolist(),
                "logical_legs": [4],
                "gauge_legs": [],
            },
            {
                "id": LegoType.T5Z.value,
                "name": "Encoding Tensor 5-1-2 Z",
                "shortName": "ET51Z",
                "description": "Z component of 5-1-2 encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_512_z.tolist(),
                "logical_legs": [4],
                "gauge_legs": [],
            },
            {
                "id": LegoType.H.value,
                "name": "Hadamard",
                "shortName": "H",
                "description": "Hadamard tensor",
                "parity_check_matrix": cls.h.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.STOPPER_X.value,
                "name": "X Stopper",
                "shortName": "X",
                "description": "X-type stopper tensor",
                "parity_check_matrix": cls.stopper_x.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.STOPPER_Z.value,
                "name": "Z Stopper",
                "shortName": "Z",
                "description": "Z-type stopper tensor",
                "parity_check_matrix": cls.stopper_z.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.STOPPER_Y.value,
                "name": "Y Stopper",
                "shortName": "Y",
                "description": "Y-type stopper tensor",
                "parity_check_matrix": cls.stopper_y.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": LegoType.STOPPER_I.value,
                "name": "Identity Stopper",
                "shortName": "I",
                "description": "Identity stopper tensor",
                "parity_check_matrix": cls.stopper_i.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
        ]

        # Add dynamic lego pieces (methods)
        legos.extend(
            [
                {
                    "id": LegoType.ZREP.value,
                    "name": "Z-Repetition Code",
                    "shortName": "ZREP3",
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
                    "shortName": "XREP3",
                    "description": "Phase flip code, XX stabilizers",
                    "is_dynamic": True,
                    "parameters": {"d": 3},
                    "parity_check_matrix": cls.x_rep_code().tolist(),
                    "logical_legs": [],
                    "gauge_legs": [],
                },
            ]
        )

        return legos
