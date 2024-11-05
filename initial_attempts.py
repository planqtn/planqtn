import os
import quimb as qu
import quimb.tensor as qtn
from matplotlib import pyplot as plt, rcParams


def draw_422_code():
    # [[4,2,2]] code encoding?

    circ = qtn.Circuit(6)

    anc = [0, 1, 2, 3]
    phys = [i for i in range(max(anc) + 1, 4)]
    log = [i for i in range(max(phys) + 1, 2)]

    circ.h(0)
    circ.h(1)

    circ.cx(0, 2)
    circ.cx(0, 3)
    circ.cx(0, 4)
    circ.cx(0, 5)

    circ.cz(1, 2)
    circ.cz(1, 3)
    circ.cz(1, 4)
    circ.cz(1, 5)

    circ.h(0)
    circ.h(1)

    print(circ)

    circ.psi.draw(ax=plt.gca(), color=["H", "CX"], figsize=[20, 10])

    os.makedirs(".tmp", exist_ok=True)
    plt.savefig(".out/test.pdf")

    print(circ.to_dense_tn())


def draw_5q_code():
    # [[5,1,3]]

    n = 5
    k = 1

    circ = qtn.Circuit(n + k + (n + k))

    anc = [i for i in range(n + k)]  # n-k + 2k for the logicals
    phys = [i for i in range(max(anc) + 1, max(anc) + 1 + n)]
    log = [i for i in range(max(phys) + 1, max(phys) + 1 + k)]

    for a in anc:
        circ.h(a)

    for offset in range(4):
        for i, gate in enumerate(["cx", "cz", "cz", "cx"]):
            circ.apply_gate(gate, qubits=(anc[i], phys[(i + offset) % 5]))
            print(phys[(i + offset) % 5], gate, " | ", end="")
        print()

    for p in phys:
        circ.cx(anc[n - k], p)
    circ.cx(anc[n - k], log[0])

    for p in phys:
        circ.cz(anc[n - k + 1], p)
    circ.cz(anc[n - k + 1], log[0])

    for a in anc:
        circ.h(a)

    tn = circ.psi

    proj = lambda ind: qtn.Tensor(data=[1, 0], inds=(ind,), tags=["proj0"])
    print(proj("k1"))
    tn = tn & proj("k0")
    tn = tn & proj("k1")
    tn = tn & proj("k2")
    tn = tn & proj("k3")
    tn = tn & proj("k4")
    tn = tn & proj("k5")
    print(tn)

    rcParams["figure.figsize"] = (20, 10)
    tn.draw(ax=plt.gca(), color=["H", "CX", "CZ", "proj0", "PSI0"])

    print(tn ^ all)

    os.makedirs(".tmp", exist_ok=True)
    plt.savefig(".out/test.pdf")


if __name__ == "__main__":
    # draw_5q_code()
    draw_422_code()
