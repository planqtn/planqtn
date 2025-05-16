import { Connection, DroppedLego } from "./types";

// Add this new function to find connected components
export function findConnectedComponent(
  startLego: DroppedLego,
  droppedLegos: DroppedLego[],
  connections: Connection[],
): TensorNetwork {
  const visited = new Set<string>();
  const component: DroppedLego[] = [];
  const componentConnections: Connection[] = [];
  const queue: string[] = [startLego.instanceId];
  visited.add(startLego.instanceId);

  // First pass: collect all connected legos using BFS
  while (queue.length > 0) {
    const currentLegoId = queue.shift()!;
    const currentLego = droppedLegos.find(
      (l) => l.instanceId === currentLegoId,
    );
    if (!currentLego) continue;
    component.push(currentLego);

    // Find all directly connected legos and add them to queue if not visited
    connections.forEach((conn) => {
      if (conn.from.legoId === currentLegoId && !visited.has(conn.to.legoId)) {
        visited.add(conn.to.legoId);
        queue.push(conn.to.legoId);
      } else if (
        conn.to.legoId === currentLegoId &&
        !visited.has(conn.from.legoId)
      ) {
        visited.add(conn.from.legoId);
        queue.push(conn.from.legoId);
      }
    });
  }

  // Second pass: collect all connections between the legos in the component
  connections.forEach((conn) => {
    if (visited.has(conn.from.legoId) && visited.has(conn.to.legoId)) {
      componentConnections.push(conn);
    }
  });

  return new TensorNetwork(component, componentConnections);
}

export interface TensorNetworkLeg {
  instanceId: string;
  legIndex: number;
}

export class TensorNetwork {
  constructor(
    public legos: DroppedLego[],
    public connections: Connection[],
    public parityCheckMatrix?: number[][],
    public weightEnumerator?: string,
    public normalizerPolynomial?: string,
    public truncateLength?: number,
    public isCalculatingWeightEnumerator?: boolean,
    public taskId?: string,
    public constructionCode?: string,
    public legOrdering?: TensorNetworkLeg[],
    public signature?: string,
  ) {}

  public static fromObj(tn: {
    legos: DroppedLego[];
    connections: Connection[];
    parityCheckMatrix?: number[][];
    weightEnumerator?: string;
    normalizerPolynomial?: string;
    truncateLength?: number;
    isCalculatingWeightEnumerator?: boolean;
    taskId?: string;
    constructionCode?: string;
    legOrdering?: TensorNetworkLeg[];
    signature?: string;
  }) {
    return new TensorNetwork(
      tn.legos,
      tn.connections,
      tn.parityCheckMatrix,
      tn.weightEnumerator,
      tn.normalizerPolynomial,
      tn.truncateLength,
      tn.isCalculatingWeightEnumerator,
      tn.taskId,
      tn.constructionCode,
      tn.legOrdering,
      tn.signature,
    );
  }

  public generateConstructionCode(): string {
    const code: string[] = [];

    // Add imports
    code.push(
      "from qlego.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator",
    );
    code.push("from qlego.tensor_network import TensorNetwork");
    code.push("from galois import GF2");
    code.push("");

    // Create nodes dictionary
    code.push("# Create nodes");
    code.push("nodes = {");
    for (const lego of this.legos) {
      const matrix = lego.parity_check_matrix.map((row: number[]) =>
        row.map((val: number) => `${val}`).join(", "),
      );
      code.push(
        `    "${lego.instanceId}": StabilizerCodeTensorEnumerator(idx="${lego.instanceId}", h=GF2([`,
      );
      for (const row of matrix) {
        code.push(`            [${row}],`);
      }
      code.push(`          ]),`);

      code.push(`    ),`);
    }
    code.push("}");
    code.push("");

    // Create tensor network
    code.push("# Create tensor network");
    code.push("tn = TensorNetwork(nodes)");
    code.push("");

    // Add traces
    code.push("# Add traces");
    for (const conn of this.connections) {
      code.push(
        `tn.self_trace("${conn.from.legoId}", "${conn.to.legoId}", [${conn.from.legIndex}], [${conn.to.legIndex}])`,
      );
    }

    return code.join("\n");
  }
}
