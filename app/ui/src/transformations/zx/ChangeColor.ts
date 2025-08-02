import { Connection } from "@/stores/connectionStore.ts";
import { DroppedLego } from "@/stores/droppedLegoStore.ts";
import { createHadamardLego } from "@/stores/droppedLegoStore.ts";
import { LogicalPoint } from "@/types/coordinates.ts";
import { Operation } from "@/features/canvas/OperationHistory.ts";
import { Legos, LegoType } from "@/features/lego/Legos";

export function canDoChangeColor(selectedLegos: DroppedLego[]): boolean {
  return (
    selectedLegos.length === 1 &&
    (selectedLegos[0].type_id === "x_rep_code" ||
      selectedLegos[0].type_id === "z_rep_code")
  );
}

const makeSpace = (
  center: { x: number; y: number },
  radius: number,
  skipLegos: DroppedLego[],
  legosToCheck: DroppedLego[]
) => {
  const skipIds = new Set(skipLegos.map((l) => l.instance_id));
  return legosToCheck.map((lego) => {
    if (skipIds.has(lego.instance_id)) return lego;
    const dx = lego.logicalPosition.x - center.x;
    const dy = lego.logicalPosition.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < radius + 80) {
      const angle = Math.atan2(dy, dx);
      const newX = center.x + (radius + 80) * Math.cos(angle);
      const newY = center.y + (radius + 80) * Math.sin(angle);
      return lego.with({ logicalPosition: new LogicalPoint(newX, newY) });
    }
    return lego;
  });
};

export const applyChangeColor = (
  lego: DroppedLego,
  droppedLegos: DroppedLego[],
  connections: Connection[]
): {
  connections: Connection[];
  droppedLegos: DroppedLego[];
  operation: Operation;
} => {
  // Get max instance ID
  const maxInstanceId = Math.max(
    ...droppedLegos.map((l) => parseInt(l.instance_id))
  );
  const numLegs = lego.numberOfLegs;

  // Find any existing connections to the original lego
  const existingConnections = connections.filter(
    (conn) =>
      conn.from.legoId === lego.instance_id ||
      conn.to.legoId === lego.instance_id
  );

  // Store the old state for history
  const oldLegos = [lego];
  const oldConnections = existingConnections;

  // Create new legos array starting with the modified original lego

  const newLego = Legos.createDynamicLego(
    lego.type_id === LegoType.XREP ? LegoType.ZREP : LegoType.XREP,
    numLegs,
    lego.instance_id,
    lego.logicalPosition
  );

  console.log(newLego);
  const newLegos: DroppedLego[] = [newLego];

  // Create new connections array
  const newConnections: Connection[] = [];

  // Make space for Hadamard legos
  const radius = 50; // Same radius as for Hadamard placement
  const updatedLegos = makeSpace(
    { x: lego.logicalPosition.x, y: lego.logicalPosition.y },
    radius,
    [lego],
    droppedLegos
  );

  // Add Hadamard legos for each leg
  for (let i = 0; i < numLegs; i++) {
    // Calculate the angle for this leg
    const angle = (2 * Math.PI * i) / numLegs;
    const hadamardLego = createHadamardLego(
      lego.logicalPosition.plus(
        new LogicalPoint(radius * Math.cos(angle), radius * Math.sin(angle))
      ),
      (maxInstanceId + 1 + i).toString()
    );

    newLegos.push(hadamardLego);

    // Connect Hadamard to the original lego
    newConnections.push(
      new Connection(
        { legoId: lego.instance_id, leg_index: i },
        { legoId: hadamardLego.instance_id, leg_index: 0 }
      )
    );

    // Connect Hadamard to the original connection if it exists
    const existingConnection = existingConnections.find((conn) =>
      conn.containsLeg(lego.instance_id, i)
    );

    if (existingConnection) {
      if (existingConnection.from.legoId === lego.instance_id) {
        newConnections.push(
          new Connection(
            { legoId: hadamardLego.instance_id, leg_index: 1 },
            existingConnection.to
          )
        );
      } else {
        newConnections.push(
          new Connection(existingConnection.from, {
            legoId: hadamardLego.instance_id,
            leg_index: 1
          })
        );
      }
    }
  }

  // Update state with the legos that were pushed out of the way
  const finalLegos = [
    ...updatedLegos.filter((l) => l.instance_id !== lego.instance_id),
    ...newLegos
  ];
  const updatedConnections = [
    ...connections.filter(
      (conn) =>
        !existingConnections.some(
          (existingConn) =>
            existingConn.from.legoId === conn.from.legoId &&
            existingConn.from.leg_index === conn.from.leg_index &&
            existingConn.to.legoId === conn.to.legoId &&
            existingConn.to.leg_index === conn.to.leg_index
        )
    ),
    ...newConnections
  ];

  // Add to history
  const operation: Operation = {
    type: "colorChange",
    data: {
      legosToRemove: oldLegos,
      connectionsToRemove: oldConnections,
      legosToAdd: newLegos,
      connectionsToAdd: newConnections
    }
  };

  return {
    connections: updatedConnections,
    droppedLegos: finalLegos,
    operation
  };
};
