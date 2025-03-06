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

    @classmethod
    def list_available_legos(cls) -> List[Dict[str, Any]]:
        """Returns a list of all available lego pieces with their descriptions."""
        legos = [
            {
                "id": "encoding_tensor_602",
                "name": "Encoding Tensor 6-0-2",
                "shortName": "ET602",
                "type": "tensor",
                "description": "6-0-2 encoding tensor for quantum error correction",
                "parity_check_matrix": cls.enconding_tensor_602.tolist()
            },
            {
                "id": "stab_code_parity_422",
                "name": "Stabilizer Code Parity 4-2-2",
                "shortName": "SC422",
                "type": "stabilizer",
                "description": "4-2-2 parity check matrix for stabilizer codes",
                "parity_check_matrix": cls.stab_code_parity_422.tolist()
            },
            {
                "id": "encoding_tensor_512",
                "name": "Encoding Tensor 5-1-2",
                "shortName": "ET512",
                "type": "tensor",
                "description": "5-1-2 encoding tensor for quantum error correction",
                "parity_check_matrix": cls.enconding_tensor_512.tolist()
            },
            {
                "id": "encoding_tensor_512_x",
                "name": "Encoding Tensor 5-1-2 X",
                "shortName": "ET51X",
                "type": "tensor",
                "description": "X component of 5-1-2 encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_512_x.tolist()
            },
            {
                "id": "encoding_tensor_512_z",
                "name": "Encoding Tensor 5-1-2 Z",
                "shortName": "ET51Z",
                "type": "tensor",
                "description": "Z component of 5-1-2 encoding tensor",
                "parity_check_matrix": cls.enconding_tensor_512_z.tolist()
            },
            {
                "id": "h",
                "name": "Hadamard Matrix",
                "shortName": "HADAM",
                "type": "matrix",
                "description": "Hadamard matrix for quantum operations",
                "parity_check_matrix": cls.h.tolist()
            }
        ]
        
        # Add dynamic lego pieces (methods)
        legos.extend([
            {
                "id": "z_rep_code",
                "name": "Z-Repetition Code",
                "shortName": "ZREP3",
                "type": "code",
                "description": "Z-type repetition code with configurable distance",
                "is_dynamic": True,
                "parameters": {"d": 3},
                "parity_check_matrix": cls.z_rep_code().tolist()
            },
            {
                "id": "x_rep_code",
                "name": "X-Repetition Code",
                "shortName": "XREP3",
                "type": "code",
                "description": "X-type repetition code with configurable distance",
                "is_dynamic": True,
                "parameters": {"d": 3},
                "parity_check_matrix": cls.x_rep_code().tolist()
            }
        ])
        
        return legos
