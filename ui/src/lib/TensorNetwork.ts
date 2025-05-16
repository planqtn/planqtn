import { Connection, DroppedLego } from "./types";
import { GF2 } from "./GF2";
import { StabilizerCodeTensor } from "./StabilizerCodeTensor";

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

  public conjoin_nodes(): StabilizerCodeTensor {
    // If there's only one lego and no connections, return its parity check matrix
    if (this.legos.length === 1 && this.connections.length === 0) {
      return new StabilizerCodeTensor(
        new GF2(this.legos[0].parity_check_matrix),
        this.legos[0].instanceId,
        Array.from(
          { length: this.legos[0].parity_check_matrix[0].length / 2 },
          (_, i) => ({ instanceId: this.legos[0].instanceId, legIndex: i }),
        ),
      );
    }

    // Map from lego instanceId to its index in components list
    type Component = {
      tensor: StabilizerCodeTensor;
      legos: Set<string>;
    };
    const components: Component[] = this.legos.map((lego) => ({
      tensor: new StabilizerCodeTensor(
        new GF2(lego.parity_check_matrix),
        lego.instanceId,
        Array.from(
          { length: lego.parity_check_matrix[0].length / 2 },
          (_, i) => ({ instanceId: lego.instanceId, legIndex: i }),
        ),
      ),
      legos: new Set([lego.instanceId]),
    }));
    const legoToComponent = new Map<string, number>();
    this.legos.forEach((lego, i) => legoToComponent.set(lego.instanceId, i));

    // Process each connection
    for (const conn of this.connections) {
      console.log(
        "=================conn",
        conn.from.legoId,
        "-",
        conn.from.legIndex,
        "->",
        conn.to.legoId,
        "-",
        conn.to.legIndex,
        "=====================",
      );
      const comp1Idx = legoToComponent.get(conn.from.legoId);
      const comp2Idx = legoToComponent.get(conn.to.legoId);

      if (comp1Idx === undefined || comp2Idx === undefined) {
        throw new Error(
          `Lego not found: ${conn.from.legoId} or ${conn.to.legoId}`,
        );
      }

      // Case 1: Both legos are in the same component
      if (comp1Idx === comp2Idx) {
        const comp = components[comp1Idx];
        console.log("self tracing", conn.from.legIndex, conn.to.legIndex);
        console.log(
          `legs: ${Array.from(comp.tensor.legToCol.entries()).map(
            ([key, value]) => `${key}->${value}`,
          )}`,
        );
        comp.tensor = comp.tensor.selfTrace(
          [{ instanceId: conn.from.legoId, legIndex: conn.from.legIndex }],
          [{ instanceId: conn.to.legoId, legIndex: conn.to.legIndex }],
        );
      }
      // Case 2: Legos are in different components - merge them
      else {
        console.log("merging", comp1Idx, comp2Idx);
        console.log(`legs1: ${components[comp1Idx].tensor.legToCol}`);
        console.log(`legs2: ${components[comp2Idx].tensor.legToCol}`);
        const comp1 = components[comp1Idx];
        const comp2 = components[comp2Idx];

        // Conjoin the tensors
        const newTensor = comp1.tensor.conjoin(
          comp2.tensor,
          [{ instanceId: conn.from.legoId, legIndex: conn.from.legIndex }],
          [{ instanceId: conn.to.legoId, legIndex: conn.to.legIndex }],
        );

        // Update the first component with merged result
        comp1.tensor = newTensor;
        // Merge the sets of legos
        comp2.legos.forEach((legoId) => {
          comp1.legos.add(legoId);
          legoToComponent.set(legoId, comp1Idx);
        });

        // Remove the second component
        components.splice(comp2Idx, 1);

        // Update indices for all legos in components after the removed one
        for (const [legoId, compIdx] of legoToComponent.entries()) {
          if (compIdx > comp2Idx) {
            legoToComponent.set(legoId, compIdx - 1);
          }
        }
      }
    }

    // If we have multiple components at the end, tensor them together
    if (components.length > 1) {
      console.log("TENSORING", components.length);
      let result = components[0].tensor;
      for (let i = 1; i < components.length; i++) {
        result = result.tensorWith(components[i].tensor);
      }
      return result;
    }

    return components[0].tensor;
  }
}
