from galois import GF2
import numpy as np
from scipy.linalg import block_diag


def conjoin(h1: GF2, h2: GF2) -> GF2:
    """Conjoins two parity check matrices via single trace on leg 0.

    Key simplifying assumptions compared to the full Cao & Lackey protocol:
        - D=2, i.e. we're working with qubits (elements are 0 and 1)
        - we trace leg 0 on both codes
        - both codes can correct erasures on leg 0
        - the parity check matrices are of row reduced form, i.e.

         [ 1 . . . | 0 . . . ]
    H1 = | 0 . . . | 1 . . . |
         [ 0   A   | 0  B    ]

    """
    r1, n1 = h1.shape
    r2, n2 = h2.shape
    n1 //= 2
    n2 //= 2

    assert n1 > 1, "Need at least 2 qubits in h1 for tracing."
    assert n2 > 1, "Need at least 2 qubits in h2 for tracing."

    assert np.nonzero(h1[:, 0])[0] == [
        0
    ], f"first X column of h1 is not 1, 0, ..., 0. Non-zero indices: {np.nonzero(h1[:, 0])}"
    assert np.nonzero(h1[:, n1])[0] == [
        1
    ], f"first Z column of h1 is not 0, 1, ..., 0. Non-zero indices: {np.nonzero(h1[:, n1])}"
    assert np.nonzero(h2[:, 0])[0] == [
        0
    ], f"first X column of h2 is not 1, 0, ..., 0. Non-zero indices: {np.nonzero(h2[:, 0])}"
    assert np.nonzero(h2[:, n1])[0] == [
        1
    ], f"first Z column of h2 is not 0, 1, ..., 0. Non-zero indices: {np.nonzero(h2[:, n1])}"

    n3 = n1 + n2 - 2
    r3 = r1 + r2 - 2
    result = GF2.Zeros((r3, 2 * n3))
    # Construct the first row
    result[0] = np.concatenate(
        (h1[0, 1:n1], h2[0, 1:n2], h1[0, n1 + 1 :], h2[0, n2 + 1 :])
    )

    # Construct the second row
    result[1] = np.concatenate(
        (h1[1, 1:n1], h2[1, 1:n2], h1[1, n1 + 1 :], h2[1, n2 + 1 :])
    )

    # A1 and A2
    result[2:, :n3] = block_diag(h1[2:, 1:n1], h2[2:, 1:n2])

    # B1 and B2
    result[2:, n3:] = block_diag(h1[2:, n1 + 1 :], h2[2:, n2 + 1 :])

    return result
