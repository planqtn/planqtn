import { Connection } from "../stores/connectionStore";
import { DroppedLego } from "../stores/droppedLegoStore.ts";
import { GF2 } from "./GF2";
import { StabilizerCodeTensor } from "./StabilizerCodeTensor";

// Add this new function to find connected components
export function findConnectedComponent(
  startLego: DroppedLego,
  droppedLegos: DroppedLego[],
  connections: Connection[]
): TensorNetwork {
  const visited = new Set<string>();
  const component: DroppedLego[] = [];
  const componentConnections: Connection[] = [];
  const queue: string[] = [startLego.instance_id];
  visited.add(startLego.instance_id);

  // First pass: collect all connected legos using BFS
  while (queue.length > 0) {
    const currentLegoId = queue.shift()!;
    const currentLego = droppedLegos.find(
      (l) => l.instance_id === currentLegoId
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

  return new TensorNetwork({
    legos: component,
    connections: componentConnections
  });
}

export interface TensorNetworkLeg {
  instance_id: string;
  leg_index: number;
}

export class TensorNetwork {
  private _legos: DroppedLego[];
  private _connections: Connection[];
  private _signature: string;

  constructor(data: {
    legos: DroppedLego[];
    connections: Connection[];
    signature?: string;
  }) {
    console.assert(data.legos, "legos is required");
    console.assert(data.connections, "connections is required");
    this._legos = data.legos;
    this._connections = data.connections;
    this._signature =
      data.signature ||
      this.createNetworkSignature(data.legos, data.connections);
  }

  public get isSingleLego(): boolean {
    return this._legos.length === 1;
  }
  public get singleLego(): DroppedLego {
    if (!this.isSingleLego) {
      throw new Error("TensorNetwork is not a single lego");
    }
    return this._legos[0];
  }

  public get legos() {
    return this._legos;
  }
  public get connections() {
    return this._connections;
  }
  public get signature() {
    return this._signature;
  }
  public set legos(legos: DroppedLego[]) {
    this._legos = legos;
    this._signature = this.createNetworkSignature(legos, this._connections);
  }
  public set connections(connections: Connection[]) {
    this._connections = connections;
    this._signature = this.createNetworkSignature(this._legos, connections);
  }
  public with(overrides: Partial<TensorNetwork>): TensorNetwork {
    return new TensorNetwork({
      ...this,
      legos: overrides.legos || this._legos || [],
      connections: overrides.connections || this._connections || [],
      signature: overrides.signature || this._signature,
      ...overrides
    });
  }

  // Helper function to generate network signature for caching
  private createNetworkSignature = (
    legos: DroppedLego[],
    connections: Connection[]
  ) => {
    const sortedLegos = [...legos]
      .sort((a, b) => a.instance_id.localeCompare(b.instance_id))
      .map(
        (lego) =>
          lego.type_id + "-" + lego.instance_id + "-" + lego.numberOfLegs
      );
    const sortedConnections = [...connections].sort((a, b) => {
      const aStr = `${a.from.legoId}${a.from.leg_index}${a.to.legoId}${a.to.leg_index}`;
      const bStr = `${b.from.legoId}${b.from.leg_index}${b.to.legoId}${b.to.leg_index}`;
      return aStr.localeCompare(bStr);
    });
    const sig = JSON.stringify({
      legos: sortedLegos,
      connections: sortedConnections
    });
    return sig;
  };

  public generateConstructionCode(): string {
    const code: string[] = [];

    // Add imports
    code.push(
      "from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator"
    );
    code.push("from planqtn.tensor_network import TensorNetwork");
    code.push("from galois import GF2");
    code.push("");

    // Create nodes dictionary
    code.push("# Create nodes");
    code.push("nodes = {");
    for (const lego of this.legos) {
      const matrix = lego.parity_check_matrix.map((row: number[]) =>
        row.map((val: number) => `${val}`).join(", ")
      );
      code.push(
        `    "${lego.instance_id}": StabilizerCodeTensorEnumerator(tensor_id="${lego.instance_id}", h=GF2([`
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
        `tn.self_trace("${conn.from.legoId}", "${conn.to.legoId}", [${conn.from.leg_index}], [${conn.to.leg_index}])`
      );
    }

    return code.join("\n");
  }

  public getExternalAndDanglingLegs(mainNetworkConnections: Connection[]): {
    externalLegs: TensorNetworkLeg[];
    danglingLegs: TensorNetworkLeg[];
  } {
    if (!this.legos) return { externalLegs: [], danglingLegs: [] };
    const allLegs: TensorNetworkLeg[] = this.legos.flatMap((lego) => {
      const numLegs = lego.numberOfLegs;
      return Array.from({ length: numLegs }, (_, i) => ({
        instance_id: lego.instance_id,
        leg_index: i
      }));
    });
    const connectedLegs = new Set<string>();
    mainNetworkConnections.forEach((conn) => {
      connectedLegs.add(`${conn.from.legoId}:${conn.from.leg_index}`);
      connectedLegs.add(`${conn.to.legoId}:${conn.to.leg_index}`);
    });
    // Legs in tensorNetwork but connected to something outside
    const networkInstanceIds = new Set(this.legos.map((l) => l.instance_id));
    const externalLegs: TensorNetworkLeg[] = [];
    const danglingLegs: TensorNetworkLeg[] = [];
    allLegs.forEach((leg) => {
      // Find if this leg is connected
      const conn = mainNetworkConnections.find(
        (conn) =>
          (conn.from.legoId === leg.instance_id &&
            conn.from.leg_index === leg.leg_index) ||
          (conn.to.legoId === leg.instance_id &&
            conn.to.leg_index === leg.leg_index)
      );
      if (!conn) {
        danglingLegs.push(leg);
      } else {
        // If the other side is not in the network, it's external
        const other =
          conn.from.legoId === leg.instance_id
            ? conn.to.legoId
            : conn.from.legoId;
        if (!networkInstanceIds.has(other)) {
          externalLegs.push(leg);
        }
      }
    });
    return { externalLegs, danglingLegs };
  }

  public conjoin_nodes(): StabilizerCodeTensor {
    // If there's only one lego and no connections, return its parity check matrix
    if (this.legos.length === 1 && this.connections.length === 0) {
      return new StabilizerCodeTensor(
        new GF2(this.legos[0].parity_check_matrix),
        this.legos[0].instance_id,
        Array.from({ length: this.legos[0].numberOfLegs }, (_, i) => ({
          instance_id: this.legos[0].instance_id,
          leg_index: i
        }))
      );
    }

    // Map from lego instance_id to its index in components list
    type Component = {
      tensor: StabilizerCodeTensor;
      legos: Set<string>;
    };
    const components: Component[] = this.legos.map((lego) => ({
      tensor: new StabilizerCodeTensor(
        new GF2(lego.parity_check_matrix),
        lego.instance_id,
        Array.from({ length: lego.numberOfLegs }, (_, i) => ({
          instance_id: lego.instance_id,
          leg_index: i
        }))
      ),
      legos: new Set([lego.instance_id])
    }));
    const legoToComponent = new Map<string, number>();
    this.legos.forEach((lego, i) => legoToComponent.set(lego.instance_id, i));

    // Process each connection
    for (const conn of this.connections) {
      const comp1Idx = legoToComponent.get(conn.from.legoId);
      const comp2Idx = legoToComponent.get(conn.to.legoId);

      if (comp1Idx === undefined || comp2Idx === undefined) {
        throw new Error(
          `Lego not found: ${conn.from.legoId} or ${conn.to.legoId}`
        );
      }

      // Case 1: Both legos are in the same component
      if (comp1Idx === comp2Idx) {
        const comp = components[comp1Idx];
        comp.tensor = comp.tensor.selfTrace(
          [{ instance_id: conn.from.legoId, leg_index: conn.from.leg_index }],
          [{ instance_id: conn.to.legoId, leg_index: conn.to.leg_index }]
        );
      }
      // Case 2: Legos are in different components - merge them
      else {
        const comp1 = components[comp1Idx];
        const comp2 = components[comp2Idx];

        // Conjoin the tensors
        const newTensor = comp1.tensor.conjoin(
          comp2.tensor,
          [{ instance_id: conn.from.legoId, leg_index: conn.from.leg_index }],
          [{ instance_id: conn.to.legoId, leg_index: conn.to.leg_index }]
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
      let result = components[0].tensor;
      for (let i = 1; i < components.length; i++) {
        result = result.tensorWith(components[i].tensor);
      }
      return result;
    }

    return components[0].tensor;
  }
}
