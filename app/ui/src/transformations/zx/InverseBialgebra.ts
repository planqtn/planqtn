import { Connection } from "@/stores/connectionStore.ts";
import { Operation } from "@/features/canvas/OperationHistory.ts";
import { Z_REP_CODE, X_REP_CODE } from "@/features/lego/LegoStyles.ts";
import _ from "lodash";
import { Legos } from "@/features/lego/Legos.ts";
import { DroppedLego } from "@/stores/droppedLegoStore.ts";
import { LogicalPoint } from "@/types/coordinates.ts";

export function canDoInverseBialgebra(
  selectedLegos: DroppedLego[],
  connections: Connection[]
): boolean {
  if (selectedLegos.length < 2) return false;

  // Partition legos by type
  const zLegos = selectedLegos.filter((lego) => lego.type_id === Z_REP_CODE);
  const xLegos = selectedLegos.filter((lego) => lego.type_id === X_REP_CODE);

  // Check if we have exactly two partitions
  if (
    zLegos.length === 0 ||
    xLegos.length === 0 ||
    zLegos.length + xLegos.length !== selectedLegos.length
  ) {
    return false;
  }

  // Check if partitions are fully connected
  for (const zLego of zLegos) {
    for (const xLego of xLegos) {
      const hasConnection = connections.some(
        (conn) =>
          conn.containsLego(zLego.instance_id) &&
          conn.containsLego(xLego.instance_id)
      );
      if (!hasConnection) return false;
    }
  }

  // Count external connections and dangling legs for each lego
  for (const lego of selectedLegos) {
    // Count external connections
    const externalConnections = connections.filter(
      (conn) =>
        conn.containsLego(lego.instance_id) &&
        !selectedLegos.some(
          (otherLego) =>
            otherLego.instance_id !== lego.instance_id &&
            conn.containsLego(otherLego.instance_id)
        )
    );

    // Count dangling legs
    const totalLegs = lego.numberOfLegs;
    const connectedLegs = connections
      .filter((conn) => conn.containsLego(lego.instance_id))
      .map((conn) =>
        conn.from.legoId === lego.instance_id
          ? conn.from.leg_index
          : conn.to.leg_index
      );
    const danglingLegs = Array.from({ length: totalLegs }, (_, i) => i).filter(
      (leg_index) => !connectedLegs.includes(leg_index)
    );

    // Check if there is exactly one external connection or dangling leg
    if (externalConnections.length + danglingLegs.length !== 1) return false;
  }

  return true;
}

export function applyInverseBialgebra(
  selectedLegos: DroppedLego[],
  droppedLegos: DroppedLego[],
  connections: Connection[]
): {
  connections: Connection[];
  droppedLegos: DroppedLego[];
  operation: Operation;
} {
  // Partition legos by type
  const zLegos = selectedLegos.filter((lego) => lego.type_id === Z_REP_CODE);
  const xLegos = selectedLegos.filter((lego) => lego.type_id === X_REP_CODE);

  // Get external connections for each partition
  const zExternalConns = connections.filter(
    (conn) =>
      zLegos.some((lego) => conn.containsLego(lego.instance_id)) &&
      !selectedLegos.some(
        (otherLego) =>
          !zLegos.includes(otherLego) &&
          conn.containsLego(otherLego.instance_id)
      )
  );

  const xExternalConns = connections.filter(
    (conn) =>
      xLegos.some((lego) => conn.containsLego(lego.instance_id)) &&
      !selectedLegos.some(
        (otherLego) =>
          !xLegos.includes(otherLego) &&
          conn.containsLego(otherLego.instance_id)
      )
  );

  // Find dangling legs for each partition
  const zDanglingLegs = zLegos.flatMap((lego) => {
    const totalLegs = lego.numberOfLegs;
    const connectedLegs = connections
      .filter((conn) => conn.containsLego(lego.instance_id))
      .map((conn) =>
        conn.from.legoId === lego.instance_id
          ? conn.from.leg_index
          : conn.to.leg_index
      );
    return Array.from({ length: totalLegs }, (_, i) => i)
      .filter((leg_index) => !connectedLegs.includes(leg_index))
      .map(() => true); // Convert to boolean array for counting
  });

  const xDanglingLegs = xLegos.flatMap((lego) => {
    const totalLegs = lego.numberOfLegs;
    const connectedLegs = connections
      .filter((conn) => conn.containsLego(lego.instance_id))
      .map((conn) =>
        conn.from.legoId === lego.instance_id
          ? conn.from.leg_index
          : conn.to.leg_index
      );
    return Array.from({ length: totalLegs }, (_, i) => i)
      .filter((leg_index) => !connectedLegs.includes(leg_index))
      .map(() => true); // Convert to boolean array for counting
  });

  // Calculate required legs for each new lego:
  // external connections + dangling legs + 1 for inter-lego connection
  const zLegoLegs = zExternalConns.length + zDanglingLegs.length + 1;
  const xLegoLegs = xExternalConns.length + xDanglingLegs.length + 1;

  // Get the maximum instance ID from existing legos
  const maxInstanceId = Math.max(
    ...droppedLegos.map((l) => parseInt(l.instance_id))
  );

  // Set positions and IDs
  const avgZPos = {
    x: _.meanBy(zLegos, (l) => l.logicalPosition.x),
    y: _.meanBy(zLegos, (l) => l.logicalPosition.y)
  };
  const avgXPos = {
    x: _.meanBy(xLegos, (l) => l.logicalPosition.x),
    y: _.meanBy(xLegos, (l) => l.logicalPosition.y)
  };

  // Create new legos (with opposite types)
  const newZLego = Legos.createDynamicLego(
    X_REP_CODE,
    zLegoLegs,
    String(maxInstanceId + 1),
    new LogicalPoint(avgZPos.x, avgZPos.y)
  );
  const newXLego = Legos.createDynamicLego(
    Z_REP_CODE,
    xLegoLegs,
    String(maxInstanceId + 2),
    new LogicalPoint(avgXPos.x, avgXPos.y)
  );

  const newLegos = [newZLego, newXLego];
  const newConnections: Connection[] = [];

  // Create connection between new legos (using their last legs)
  newConnections.push(
    new Connection(
      { legoId: newZLego.instance_id, leg_index: zLegoLegs - 1 },
      { legoId: newXLego.instance_id, leg_index: xLegoLegs - 1 }
    )
  );

  // Create external connections for Z partition
  zExternalConns.forEach((conn, index) => {
    // Find the external end that's not part of the Z partition
    const externalEnd = zLegos.some(
      (lego) => lego.instance_id === conn.from.legoId
    )
      ? conn.to
      : conn.from;
    newConnections.push(
      new Connection(
        { legoId: newZLego.instance_id, leg_index: index },
        externalEnd
      )
    );
  });

  // Create external connections for X partition
  xExternalConns.forEach((conn, index) => {
    // Find the external end that's not part of the X partition
    const externalEnd = xLegos.some(
      (lego) => lego.instance_id === conn.from.legoId
    )
      ? conn.to
      : conn.from;
    newConnections.push(
      new Connection(
        { legoId: newXLego.instance_id, leg_index: index },
        externalEnd
      )
    );
  });

  // Note: Dangling legs are automatically handled by not creating connections for them
  // They use indices after the external connections but before the inter-lego connection

  // Remove old legos and their connections
  const updatedDroppedLegos = droppedLegos
    .filter(
      (lego) => !selectedLegos.some((l) => l.instance_id === lego.instance_id)
    )
    .concat(newLegos);

  const updatedConnections = connections
    .filter(
      (conn) =>
        !selectedLegos.some((lego) => conn.containsLego(lego.instance_id))
    )
    .concat(newConnections);

  console.log("updatedDroppedLegos", updatedDroppedLegos);
  console.log("updatedConnections", updatedConnections);

  return {
    connections: updatedConnections,
    droppedLegos: updatedDroppedLegos,
    operation: {
      type: "inverseBialgebra",
      data: {
        legosToRemove: selectedLegos,
        connectionsToRemove: connections.filter((conn) =>
          selectedLegos.some((lego) => conn.containsLego(lego.instance_id))
        ),
        legosToAdd: newLegos,
        connectionsToAdd: newConnections
      }
    }
  };
}
