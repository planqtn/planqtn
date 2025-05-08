import sys
import time
from qlego.progress_reporter import TqdmProgressReporter
from qlego.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from qlego.tensor_network import TensorNetwork
from galois import GF2

nodes = {}
nodes["327"] = StabilizerCodeTensorEnumerator(
    h=GF2([[0, 0]]),
    idx="327",
)
nodes["574"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1],
        ]
    ),
    idx="574",
)
nodes["575"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        ]
    ),
    idx="575",
)
nodes["576"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        ]
    ),
    idx="576",
)
nodes["577"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        ]
    ),
    idx="577",
)
nodes["578"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        ]
    ),
    idx="578",
)
nodes["579"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
            [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
        ]
    ),
    idx="579",
)
nodes["580"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 1, 1, 1, 1],
            [1, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0],
            [0, 1, 0, 1, 0, 0, 0, 0],
        ]
    ),
    idx="580",
)
nodes["581"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 1, 1, 1, 1],
            [0, 1, 0, 1, 0, 0, 0, 0],
            [1, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0],
        ]
    ),
    idx="581",
)
nodes["582"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 1, 1, 1, 1],
            [0, 1, 0, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0],
            [1, 0, 0, 1, 0, 0, 0, 0],
        ]
    ),
    idx="582",
)
nodes["583"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 1, 1, 1, 1],
            [1, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0],
            [0, 1, 0, 1, 0, 0, 0, 0],
        ]
    ),
    idx="583",
)
nodes["584"] = StabilizerCodeTensorEnumerator(
    h=GF2(
        [
            [0, 0, 0, 0, 1, 1, 1, 1],
            [1, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0, 0, 0],
            [0, 1, 0, 1, 0, 0, 0, 0],
        ]
    ),
    idx="584",
)
nodes["585"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="585",
)
nodes["586"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="586",
)
nodes["587"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="587",
)
nodes["588"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="588",
)
nodes["589"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="589",
)
nodes["590"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="590",
)
nodes["591"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="591",
)
nodes["592"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="592",
)
nodes["593"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="593",
)
nodes["594"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="594",
)
nodes["595"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="595",
)
nodes["596"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="596",
)
nodes["597"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="597",
)
nodes["598"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="598",
)
nodes["599"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="599",
)
nodes["600"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="600",
)
nodes["601"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="601",
)
nodes["602"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="602",
)
nodes["603"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="603",
)
nodes["604"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="604",
)
nodes["605"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="605",
)
nodes["606"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="606",
)
nodes["607"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="607",
)
nodes["608"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="608",
)
nodes["611"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="611",
)
nodes["612"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="612",
)
nodes["613"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="613",
)
nodes["614"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="614",
)
nodes["615"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="615",
)
nodes["616"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="616",
)
nodes["619"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="619",
)
nodes["620"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="620",
)
nodes["621"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="621",
)
nodes["622"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="622",
)
nodes["624"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="624",
)
nodes["629"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="629",
)
nodes["630"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="630",
)
nodes["631"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="631",
)
nodes["632"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="632",
)
nodes["633"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="633",
)
nodes["634"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="634",
)
nodes["635"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="635",
)
nodes["636"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="636",
)
nodes["637"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="637",
)
nodes["638"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="638",
)
nodes["639"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="639",
)
nodes["640"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="640",
)
nodes["641"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="641",
)
nodes["642"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="642",
)
nodes["643"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="643",
)
nodes["644"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="644",
)
nodes["645"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="645",
)
nodes["646"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="646",
)
nodes["647"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="647",
)
nodes["648"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="648",
)
nodes["650"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="650",
)
nodes["651"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="651",
)
nodes["652"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="652",
)
nodes["654"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 1, 0, 0, 0, 1], [0, 0, 1, 0, 1, 0], [0, 0, 0, 1, 1, 0]]),
    idx="654",
)
nodes["655"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="655",
)
nodes["656"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="656",
)
nodes["657"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="657",
)
nodes["658"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="658",
)
nodes["659"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="659",
)
nodes["660"] = StabilizerCodeTensorEnumerator(
    h=GF2([[1, 0, 0, 0, 1, 1], [0, 0, 1, 1, 0, 0], [0, 1, 0, 1, 0, 0]]),
    idx="660",
)

# Create TensorNetwork
tn = TensorNetwork(nodes, truncate_length=7)

# Add traces
tn.self_trace("574", "327", [10], [0])
tn.self_trace("575", "587", [3], [2])
tn.self_trace("587", "586", [0], [1])
tn.self_trace("575", "588", [2], [2])
tn.self_trace("589", "588", [0], [1])
tn.self_trace("575", "590", [5], [2])
tn.self_trace("590", "589", [0], [2])
tn.self_trace("575", "591", [4], [2])
tn.self_trace("591", "580", [0], [3])
tn.self_trace("576", "592", [1], [2])
tn.self_trace("592", "580", [0], [2])
tn.self_trace("576", "593", [0], [2])
tn.self_trace("594", "593", [0], [1])
tn.self_trace("576", "595", [3], [2])
tn.self_trace("595", "594", [0], [2])
tn.self_trace("576", "596", [2], [2])
tn.self_trace("597", "596", [0], [1])
tn.self_trace("576", "598", [5], [2])
tn.self_trace("598", "597", [0], [2])
tn.self_trace("576", "599", [4], [2])
tn.self_trace("599", "600", [0], [2])
tn.self_trace("576", "601", [7], [2])
tn.self_trace("601", "600", [0], [1])
tn.self_trace("576", "602", [6], [2])
tn.self_trace("602", "582", [0], [2])
tn.self_trace("578", "603", [3], [2])
tn.self_trace("603", "582", [0], [1])
tn.self_trace("578", "604", [2], [2])
tn.self_trace("605", "604", [0], [1])
tn.self_trace("578", "606", [5], [2])
tn.self_trace("606", "605", [0], [2])
tn.self_trace("578", "607", [4], [2])
tn.self_trace("607", "608", [0], [2])
tn.self_trace("578", "612", [8], [2])
tn.self_trace("612", "611", [0], [2])
tn.self_trace("578", "613", [9], [2])
tn.self_trace("613", "584", [0], [3])
tn.self_trace("579", "614", [5], [2])
tn.self_trace("614", "584", [0], [2])
tn.self_trace("579", "615", [4], [2])
tn.self_trace("615", "616", [0], [2])
tn.self_trace("579", "620", [8], [2])
tn.self_trace("620", "619", [0], [2])
tn.self_trace("579", "621", [9], [2])
tn.self_trace("621", "622", [0], [2])
tn.self_trace("579", "624", [0], [2])
tn.self_trace("624", "583", [0], [3])
tn.self_trace("578", "629", [0], [2])
tn.self_trace("574", "629", [5], [1])
tn.self_trace("629", "582", [0], [0])
tn.self_trace("578", "630", [1], [2])
tn.self_trace("574", "630", [4], [1])
tn.self_trace("630", "584", [0], [1])
tn.self_trace("574", "631", [3], [2])
tn.self_trace("579", "631", [2], [1])
tn.self_trace("631", "584", [0], [0])
tn.self_trace("574", "632", [2], [2])
tn.self_trace("579", "632", [3], [1])
tn.self_trace("632", "583", [0], [0])
tn.self_trace("574", "633", [1], [1])
tn.self_trace("577", "633", [5], [2])
tn.self_trace("633", "581", [0], [1])
tn.self_trace("574", "634", [0], [1])
tn.self_trace("577", "634", [4], [2])
tn.self_trace("634", "583", [0], [1])
tn.self_trace("574", "635", [7], [1])
tn.self_trace("576", "635", [9], [2])
tn.self_trace("635", "580", [0], [0])
tn.self_trace("574", "636", [6], [1])
tn.self_trace("576", "636", [8], [2])
tn.self_trace("636", "582", [0], [3])
tn.self_trace("574", "637", [8], [1])
tn.self_trace("575", "637", [7], [2])
tn.self_trace("637", "580", [0], [1])
tn.self_trace("574", "638", [9], [1])
tn.self_trace("575", "638", [6], [2])
tn.self_trace("638", "581", [0], [0])
tn.self_trace("575", "639", [8], [2])
tn.self_trace("639", "581", [0], [3])
tn.self_trace("575", "640", [9], [2])
tn.self_trace("640", "641", [0], [2])
tn.self_trace("575", "642", [1], [1])
tn.self_trace("641", "642", [0], [2])
tn.self_trace("575", "643", [0], [2])
tn.self_trace("643", "586", [0], [2])
tn.self_trace("577", "644", [3], [2])
tn.self_trace("644", "585", [0], [1])
tn.self_trace("577", "645", [2], [2])
tn.self_trace("645", "581", [0], [2])
tn.self_trace("577", "646", [0], [2])
tn.self_trace("646", "585", [0], [2])
tn.self_trace("577", "647", [1], [2])
tn.self_trace("647", "648", [0], [2])
tn.self_trace("577", "650", [8], [2])
tn.self_trace("577", "651", [9], [2])
tn.self_trace("648", "651", [0], [1])
tn.self_trace("650", "652", [0], [2])
tn.self_trace("577", "654", [7], [2])
tn.self_trace("654", "583", [0], [2])
tn.self_trace("577", "655", [6], [2])
tn.self_trace("652", "655", [0], [1])
tn.self_trace("579", "656", [1], [2])
tn.self_trace("622", "656", [0], [1])
tn.self_trace("579", "657", [7], [2])
tn.self_trace("616", "657", [0], [1])
tn.self_trace("579", "658", [6], [2])
tn.self_trace("619", "658", [0], [1])
tn.self_trace("578", "659", [6], [2])
tn.self_trace("611", "659", [0], [1])
tn.self_trace("578", "660", [7], [2])
tn.self_trace("608", "660", [0], [1])

start = time.time()
print(
    tn.stabilizer_enumerator_polynomial(
        progress_reporter=TqdmProgressReporter(file=sys.stdout, mininterval=1),
    )
)
print(time.time() - start)
