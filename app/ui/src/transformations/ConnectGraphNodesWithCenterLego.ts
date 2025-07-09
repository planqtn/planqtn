import { Connection } from "../stores/connectionStore";
import { Operation } from "../features/canvas/OperationHistory.ts";
import { zip } from "lodash";
import { Legos } from "../features/lego/Legos.ts";
import { DroppedLego } from "../stores/droppedLegoStore.ts";
import { LogicalPoint } from "../types/coordinates.ts";

export const canDoConnectGraphNodes = (legos: DroppedLego[]): boolean => {
  return (
    legos.length > 0 && legos.every((lego) => lego.typeId === "z_rep_code")
  );
};

export const applyConnectGraphNodes = async (
  legos: DroppedLego[],
  allLegos: DroppedLego[],
  connections: Connection[]
): Promise<{
  droppedLegos: DroppedLego[];
  connections: Connection[];
  operation: Operation;
}> => {
  // Get max instance ID
  const maxInstanceId = Math.max(
    ...allLegos.map((l) => parseInt(l.instanceId))
  );
  const numLegs = legos.length + 1;

  // Create the connector lego
  const connectorLego = Legos.createDynamicLego(
    "z_rep_code",
    numLegs,
    (maxInstanceId + 1).toString(),
    new LogicalPoint(
      legos.reduce((sum, l) => sum + l.logicalPosition.x, 0) / legos.length,
      legos.reduce((sum, l) => sum + l.logicalPosition.y, 0) / legos.length
    )
  );

  // Find dangling legs for each lego
  const legoDanglingLegs = legos.map((lego) => {
    const numLegs = lego.numberOfLegs;
    const connectedLegs = new Set<number>();

    // Find all connected legs
    connections.forEach((conn) => {
      if (conn.from.legoId === lego.instanceId) {
        connectedLegs.add(conn.from.legIndex);
      }
      if (conn.to.legoId === lego.instanceId) {
        connectedLegs.add(conn.to.legIndex);
      }
    });

    // Find first dangling leg (a leg that is NOT in connectedLegs)
    let danglingLeg = 0;
    while (connectedLegs.has(danglingLeg) && danglingLeg < numLegs) {
      danglingLeg++;
    }

    return {
      lego,
      danglingLeg: danglingLeg < numLegs ? danglingLeg : numLegs
    };
  });

  // Create new legos with one extra leg
  const newLegos: DroppedLego[] = legoDanglingLegs.map(
    ({ lego, danglingLeg }) => {
      if (danglingLeg !== lego.numberOfLegs) {
        return lego; // Keep the lego as is if it has dangling legs
      }
      return Legos.createDynamicLego(
        "z_rep_code",
        lego.numberOfLegs + 1,
        lego.instanceId,
        lego.logicalPosition
      );
    }
  );

  // Create Hadamard legos
  const hadamardLegos: DroppedLego[] = legoDanglingLegs.map(
    ({ lego }, index) => {
      // Position Hadamard halfway between connector and original lego
      return new DroppedLego(
        {
          typeId: "h",
          name: "Hadamard",
          shortName: "H",
          description: "Hadamard",
          parity_check_matrix: [
            [1, 0, 0, 1],
            [0, 1, 1, 0]
          ],
          logical_legs: [],
          gauge_legs: []
        },
        new LogicalPoint(
          (connectorLego.logicalPosition.x + lego.logicalPosition.x) / 2,
          (connectorLego.logicalPosition.y + lego.logicalPosition.y) / 2
        ),
        (maxInstanceId + 2 + index).toString()
      );
    }
  );

  // Create connections between connector, Hadamards, and new legos
  const newConnections: Connection[] = legoDanglingLegs.flatMap(
    ({ lego, danglingLeg }, index) => {
      return [
        new Connection(
          { legoId: connectorLego.instanceId, legIndex: index },
          { legoId: hadamardLegos[index].instanceId, legIndex: 0 }
        ),
        new Connection(
          { legoId: hadamardLegos[index].instanceId, legIndex: 1 },
          { legoId: lego.instanceId, legIndex: danglingLeg }
        )
      ];
    }
  );

  // Update state
  const updatedLegos = [
    ...allLegos.filter(
      (l) => !legos.some((selected) => selected.instanceId === l.instanceId)
    ),
    ...newLegos,
    connectorLego,
    ...hadamardLegos
  ];

  const updatedConnections = [...connections, ...newConnections];

  // Create operation for undo/redo
  const operation: Operation = {
    type: "connectGraphNodesWithCenterLego",
    data: {
      legosToUpdate: (zip(legos, newLegos) as [DroppedLego, DroppedLego][]).map(
        ([lego, newLego]) => ({ oldLego: lego, newLego: newLego })
      ),
      legosToAdd: [connectorLego, ...hadamardLegos],
      connectionsToAdd: newConnections
    }
  };

  return {
    droppedLegos: updatedLegos,
    connections: updatedConnections,
    operation
  };
};
