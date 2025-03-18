import numpy as np
import networkx as nx


def random_graph_state_parity_check(n, p=0.5):
    # Generate a random connected graph with n qubits
    # Using connected_watts_strogatz_graph which guarantees connectivity
    # k is the number of nearest neighbors (default 2)
    # p is the rewiring probability (default 0.5)
    G = nx.connected_watts_strogatz_graph(n, k=2, p=p)

    # Initialize X and Z parts of the matrix
    A = np.eye(n, dtype=int)  # Identity matrix for X part
    B = np.zeros((n, n), dtype=int)  # Zero matrix for Z part

    # Fill the Z part based on the graph adjacency
    for i in range(n):
        neighbors = list(G.neighbors(i))
        B[i, neighbors] = 1

    # Concatenate X and Z parts to form the symplectic matrix
    H = np.hstack((A, B))
    return H


# Example usage
n = 8  # Number of qubits
H = random_graph_state_parity_check(n, p=0.5)
print("\n".join([" ".join(map(str, row)) for row in H]))
