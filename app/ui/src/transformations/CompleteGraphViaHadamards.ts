import { Connection } from "../lib/types";

import { Legos } from "../features/lego/Legos.ts";
import { createHadamardLego, DroppedLego } from "../stores/droppedLegoStore.ts";
import { Operation } from "../features/canvas/OperationHistory.ts";

export const canDoCompleteGraphViaHadamards = (
  legos: DroppedLego[]
): boolean => {
  return legos.length > 1 && legos.every((lego) => lego.id === "z_rep_code");
};

const getDanglingLegs = (
  legos: DroppedLego[],
  connections: Connection[]
): { lego: DroppedLego; danglingLegs: number[] }[] => {
  return legos.map((lego) => {
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

    // Find all dangling legs
    const danglingLegs: number[] = [];
    for (let i = 0; i < numLegs; i++) {
      if (!connectedLegs.has(i)) {
        danglingLegs.push(i);
      }
    }

    return {
      lego,
      danglingLegs
    };
  });
};
export const applyCompleteGraphViaHadamards = async (
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

  // Find dangling legs for each lego
  const oldLegoDanglingLegs = getDanglingLegs(legos, connections);

  // Create new legos with extra legs for connections
  const newLegos: DroppedLego[] = oldLegoDanglingLegs.map(
    ({ lego, danglingLegs }) => {
      // Calculate how many new legs we need
      const numNewLegs = legos.length - 1 - danglingLegs.length; // Each lego needs to connect to all others
      if (numNewLegs <= 0) {
        return lego; // Keep the lego as is if it has enough dangling legs
      }
      return Legos.createDynamicLego(
        "z_rep_code",
        lego.numberOfLegs + numNewLegs,
        lego.instanceId,
        lego.x,
        lego.y
      );
    }
  );

  const legoDanglingLegs = getDanglingLegs(newLegos, connections);

  // Create Hadamard legos for each connection
  const hadamardLegos: DroppedLego[] = [];
  const newConnections: Connection[] = [];
  let hadamardIndex = 0;

  // Track which dangling legs have been used for each lego
  const usedDanglingLegs: Map<string, Set<number>> = new Map();
  legos.forEach((lego) => usedDanglingLegs.set(lego.instanceId, new Set()));

  // Create connections between all pairs of legos
  for (let i = 0; i < legos.length; i++) {
    const lego1 = newLegos[i];
    const lego1DanglingLegs = legoDanglingLegs[i].danglingLegs;
    let newLegsOffset1 = 0;

    for (let j = i + 1; j < legos.length; j++) {
      const lego2 = newLegos[j];
      const lego2DanglingLegs = legoDanglingLegs[j].danglingLegs;

      // Create Hadamard lego
      const hadamardLego: DroppedLego = createHadamardLego(
        (lego1.x + lego2.x) / 2,
        (lego1.y + lego2.y) / 2,
        (maxInstanceId + 1 + hadamardIndex).toString()
      );
      hadamardLegos.push(hadamardLego);

      // Find next unused dangling leg for lego1
      let legIndex1: number;
      const usedLegs1 = usedDanglingLegs.get(lego1.instanceId)!;
      const availableDanglingLeg1 = lego1DanglingLegs.find(
        (leg) => !usedLegs1.has(leg)
      );

      if (availableDanglingLeg1 !== undefined) {
        legIndex1 = availableDanglingLeg1;
        usedLegs1.add(legIndex1);
      } else {
        // Use a new leg if no dangling legs are available
        legIndex1 = lego1.numberOfLegs - (legos.length - 1) + newLegsOffset1;
        newLegsOffset1++;
      }

      // Find next unused dangling leg for lego2
      let legIndex2: number;
      const usedLegs2 = usedDanglingLegs.get(lego2.instanceId)!;
      const availableDanglingLeg2 = lego2DanglingLegs.find(
        (leg) => !usedLegs2.has(leg)
      );

      if (availableDanglingLeg2 !== undefined) {
        legIndex2 = availableDanglingLeg2;
        usedLegs2.add(legIndex2);
      } else {
        // Use a new leg if no dangling legs are available
        legIndex2 = lego2.numberOfLegs - (legos.length - j) + usedLegs2.size;
      }

      // Create connections
      newConnections.push(
        new Connection(
          { legoId: lego1.instanceId, legIndex: legIndex1 },
          { legoId: hadamardLego.instanceId, legIndex: 0 }
        ),
        new Connection(
          { legoId: hadamardLego.instanceId, legIndex: 1 },
          { legoId: lego2.instanceId, legIndex: legIndex2 }
        )
      );

      hadamardIndex++;
    }
  }

  // Update state
  const updatedLegos = [
    ...allLegos.filter(
      (l) => !legos.some((selected) => selected.instanceId === l.instanceId)
    ),
    ...newLegos,
    ...hadamardLegos
  ];

  const updatedConnections = [...connections, ...newConnections];

  // Create operation for undo/redo
  const operation: Operation = {
    type: "completeGraphViaHadamards",
    data: {
      legosToUpdate: legos.map((lego, i) => ({
        oldLego: lego,
        newLego: newLegos[i]
      })),
      legosToAdd: hadamardLegos,
      connectionsToAdd: newConnections
    }
  };

  return {
    droppedLegos: updatedLegos,
    connections: updatedConnections,
    operation
  };
};
