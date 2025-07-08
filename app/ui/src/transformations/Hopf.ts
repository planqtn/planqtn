import { Connection } from "../stores/connectionStore";
import { Operation } from "../features/canvas/OperationHistory.ts";
import { Z_REP_CODE, X_REP_CODE } from "../features/lego/LegoStyles.ts";
import { Legos } from "../features/lego/Legos.ts";
import { DroppedLego } from "../stores/droppedLegoStore.ts";

export function canDoHopfRule(
  selectedLegos: DroppedLego[],
  connections: Connection[]
): boolean {
  // Check if exactly two legos are selected
  if (selectedLegos.length !== 2) return false;

  // Check if one is X and one is Z type
  const [lego1, lego2] = selectedLegos;
  const hasXAndZ =
    (lego1.type_id === X_REP_CODE && lego2.type_id === Z_REP_CODE) ||
    (lego1.type_id === Z_REP_CODE && lego2.type_id === X_REP_CODE);
  if (!hasXAndZ) return false;

  // Count connections between the two legos
  const connectionsBetween = connections.filter(
    (conn) =>
      conn.containsLego(lego1.instanceId) && conn.containsLego(lego2.instanceId)
  );

  // Must have more than one connection between them
  return connectionsBetween.length > 1;
}

export async function applyHopfRule(
  selectedLegos: DroppedLego[],
  droppedLegos: DroppedLego[],
  connections: Connection[]
): Promise<{
  connections: Connection[];
  droppedLegos: DroppedLego[];
  operation: Operation;
}> {
  // Get the X and Z legos in correct order
  const [xLego, zLego] =
    selectedLegos[0].type_id === X_REP_CODE
      ? [selectedLegos[0], selectedLegos[1]]
      : [selectedLegos[1], selectedLegos[0]];

  // Get all connections between the two legos
  const connectionsBetween = connections.filter(
    (conn) =>
      conn.containsLego(xLego.instanceId) && conn.containsLego(zLego.instanceId)
  );

  // Get external connections for each lego
  const xExternalConns = connections.filter(
    (conn) =>
      conn.containsLego(xLego.instanceId) &&
      !conn.containsLego(zLego.instanceId)
  );
  const zExternalConns = connections.filter(
    (conn) =>
      conn.containsLego(zLego.instanceId) &&
      !conn.containsLego(xLego.instanceId)
  );

  // Calculate new number of legs for each lego (current - 2 for each pair removed)
  const numPairsToRemove = 1; // We remove one pair of connections
  const newXLegs = xLego.numberOfLegs - 2 * numPairsToRemove;
  const newZLegs = zLego.numberOfLegs - 2 * numPairsToRemove;

  // Get the maximum instance ID from existing legos
  const maxInstanceId = Math.max(
    ...droppedLegos.map((l) => parseInt(l.instanceId))
  );

  // Create new legos with reduced legs
  const newXLego = Legos.createDynamicLego(
    X_REP_CODE,
    newXLegs,
    String(maxInstanceId + 1),
    xLego.logicalPosition
  );
  const newZLego = Legos.createDynamicLego(
    Z_REP_CODE,
    newZLegs,
    String(maxInstanceId + 2),
    zLego.logicalPosition
  );

  const newLegos = [newXLego, newZLego];
  const newConnections: Connection[] = [];

  // Get the internal connections to remove (first pair)
  const connectionsToRemove = connectionsBetween.slice(0, 2);
  const remainingConnections = connectionsBetween.slice(2);

  // Create a mapping of old leg indices to new leg indices for each lego
  const xLegMapping = new Map<number, number>();
  const zLegMapping = new Map<number, number>();
  let nextXLegIndex = 0;
  let nextZLegIndex = 0;

  // Map all legs except the ones that were connected internally
  for (let i = 0; i < xLego.numberOfLegs; i++) {
    if (
      !connectionsToRemove.some(
        (conn) =>
          (conn.from.legoId === xLego.instanceId && conn.from.legIndex === i) ||
          (conn.to.legoId === xLego.instanceId && conn.to.legIndex === i)
      )
    ) {
      xLegMapping.set(i, nextXLegIndex++);
    }
  }

  for (let i = 0; i < zLego.numberOfLegs; i++) {
    if (
      !connectionsToRemove.some(
        (conn) =>
          (conn.from.legoId === zLego.instanceId && conn.from.legIndex === i) ||
          (conn.to.legoId === zLego.instanceId && conn.to.legIndex === i)
      )
    ) {
      zLegMapping.set(i, nextZLegIndex++);
    }
  }

  // Recreate external connections for X lego
  xExternalConns.forEach((conn) => {
    const oldLegIndex =
      conn.from.legoId === xLego.instanceId
        ? conn.from.legIndex
        : conn.to.legIndex;
    const externalEnd =
      conn.from.legoId === xLego.instanceId ? conn.to : conn.from;
    const newLegIndex = xLegMapping.get(oldLegIndex);

    if (newLegIndex !== undefined) {
      newConnections.push(
        new Connection(
          conn.from.legoId === xLego.instanceId
            ? { legoId: newXLego.instanceId, legIndex: newLegIndex }
            : externalEnd,
          conn.from.legoId === xLego.instanceId
            ? externalEnd
            : { legoId: newXLego.instanceId, legIndex: newLegIndex }
        )
      );
    }
  });

  // Recreate external connections for Z lego
  zExternalConns.forEach((conn) => {
    const oldLegIndex =
      conn.from.legoId === zLego.instanceId
        ? conn.from.legIndex
        : conn.to.legIndex;
    const externalEnd =
      conn.from.legoId === zLego.instanceId ? conn.to : conn.from;
    const newLegIndex = zLegMapping.get(oldLegIndex);

    if (newLegIndex !== undefined) {
      newConnections.push(
        new Connection(
          conn.from.legoId === zLego.instanceId
            ? { legoId: newZLego.instanceId, legIndex: newLegIndex }
            : externalEnd,
          conn.from.legoId === zLego.instanceId
            ? externalEnd
            : { legoId: newZLego.instanceId, legIndex: newLegIndex }
        )
      );
    }
  });

  // Recreate remaining internal connections between the legos (if any)
  remainingConnections.forEach((conn) => {
    const oldXLegIndex =
      conn.from.legoId === xLego.instanceId
        ? conn.from.legIndex
        : conn.to.legIndex;
    const oldZLegIndex =
      conn.from.legoId === zLego.instanceId
        ? conn.from.legIndex
        : conn.to.legIndex;
    const newXLegIndex = xLegMapping.get(oldXLegIndex);
    const newZLegIndex = zLegMapping.get(oldZLegIndex);

    if (newXLegIndex !== undefined && newZLegIndex !== undefined) {
      newConnections.push(
        new Connection(
          { legoId: newXLego.instanceId, legIndex: newXLegIndex },
          { legoId: newZLego.instanceId, legIndex: newZLegIndex }
        )
      );
    }
  });

  // Remove old legos and their connections
  const updatedDroppedLegos = droppedLegos
    .filter(
      (lego) => !selectedLegos.some((l) => l.instanceId === lego.instanceId)
    )
    .concat(newLegos);

  const updatedConnections = connections
    .filter(
      (conn) =>
        !selectedLegos.some((lego) => conn.containsLego(lego.instanceId))
    )
    .concat(newConnections);

  return {
    connections: updatedConnections,
    droppedLegos: updatedDroppedLegos,
    operation: {
      type: "hopf",
      data: {
        legosToRemove: selectedLegos,
        connectionsToRemove: connections.filter((conn) =>
          selectedLegos.some((lego) => conn.containsLego(lego.instanceId))
        ),
        legosToAdd: newLegos,
        connectionsToAdd: newConnections
      }
    }
  };
}
