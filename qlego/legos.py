from galois import GF2
import numpy as np
from typing import List, Dict, Any


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
                "id": "encoding_tensor_602",
                "name": "Encoding Tensor 6-0-2",
                "shortName": "T6",
                "type": "tensor",
                "description": "[[6,0,2]] encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_602.tolist(),
                "logical_legs": [4, 5],
                "gauge_legs": [],
            },
            {
                "id": "encoding_tensor_512",
                "name": "Encoding Tensor 5-1-2",
                "shortName": "T6/5",
                "type": "tensor",
                "description": "[[5,1,2]] encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_512.tolist(),
                "logical_legs": [4],
                "gauge_legs": [],
            },
            {
                "id": "stab_code_parity_422",
                "name": "Stabilizer Code Parity 4-2-2",
                "shortName": "T6/4",
                "type": "stabilizer",
                "description": "[[4,2,2]] parity check matrix",
                "parity_check_matrix": cls.stab_code_parity_422.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": "encoding_tensor_512_x",
                "name": "Encoding Tensor 5-1-2 X",
                "shortName": "ET51X",
                "type": "tensor",
                "description": "X component of 5-1-2 encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_512_x.tolist(),
                "logical_legs": [4],
                "gauge_legs": [],
            },
            {
                "id": "encoding_tensor_512_z",
                "name": "Encoding Tensor 5-1-2 Z",
                "shortName": "ET51Z",
                "type": "tensor",
                "description": "Z component of 5-1-2 encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_512_z.tolist(),
                "logical_legs": [4],
                "gauge_legs": [],
            },
            {
                "id": "h",
                "name": "Hadamard Matrix",
                "shortName": "H",
                "type": "matrix",
                "description": "Hadamard tensor",
                "parity_check_matrix": cls.h.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": "stopper_x",
                "name": "X Stopper",
                "shortName": "X",
                "type": "stopper",
                "description": "X-type stopper tensor",
                "parity_check_matrix": cls.stopper_x.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": "stopper_z",
                "name": "Z Stopper",
                "shortName": "Z",
                "type": "stopper",
                "description": "Z-type stopper tensor",
                "parity_check_matrix": cls.stopper_z.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": "stopper_y",
                "name": "Y Stopper",
                "shortName": "Y",
                "type": "stopper",
                "description": "Y-type stopper tensor",
                "parity_check_matrix": cls.stopper_y.tolist(),
                "logical_legs": [],
                "gauge_legs": [],
            },
            {
                "id": "stopper_i",
                "name": "Identity Stopper",
                "shortName": "I",
                "type": "stopper",
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
                    "id": "z_rep_code",
                    "name": "Z-Repetition Code",
                    "shortName": "ZREP3",
                    "type": "code",
                    "description": "Z-type repetition code with configurable distance",
                    "is_dynamic": True,
                    "parameters": {"d": 3},
                    "parity_check_matrix": cls.z_rep_code().tolist(),
                    "logical_legs": [2],
                    "gauge_legs": [],
                },
                {
                    "id": "x_rep_code",
                    "name": "X-Repetition Code",
                    "shortName": "XREP3",
                    "type": "code",
                    "description": "X-type repetition code with configurable distance",
                    "is_dynamic": True,
                    "parameters": {"d": 3},
                    "parity_check_matrix": cls.x_rep_code().tolist(),
                    "logical_legs": [2],
                    "gauge_legs": [],
                },
            ]
        )

        return legos
