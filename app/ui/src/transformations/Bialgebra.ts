import { Connection } from "../stores/connectionStore";
import { Operation } from "../features/canvas/OperationHistory.ts";
import { Z_REP_CODE, X_REP_CODE } from "../features/lego/LegoStyles.ts";
import _ from "lodash";
import { DroppedLego } from "../stores/droppedLegoStore.ts";
import { Legos } from "../features/lego/Legos.ts";
import { LogicalPoint } from "../types/coordinates.ts";

export function canDoBialgebra(
  selectedLegos: DroppedLego[],
  connections: Connection[]
): boolean {
  if (selectedLegos.length !== 2) return false;
  const [lego1, lego2] = selectedLegos;

  const lego_types = new Set([lego1.type_id, lego2.type_id]);
  if (!_.isEqual(lego_types, new Set([Z_REP_CODE, X_REP_CODE]))) {
    return false;
  }

  // Count connections between the two selected legos
  const connectionsBetween = connections.filter(
    (conn) =>
      conn.containsLego(lego1.instance_id) &&
      conn.containsLego(lego2.instance_id)
  );
  // There should be exactly one connection between them
  return connectionsBetween.length === 1;
}

export async function applyBialgebra(
  legosToCommute: DroppedLego[],
  droppedLegos: DroppedLego[],
  connections: Connection[]
): Promise<{
  connections: Connection[];
  droppedLegos: DroppedLego[];
  operation: Operation;
}> {
  const [lego1, lego2] = legosToCommute;
  const connectionsBetween = connections.filter(
    (conn) =>
      conn.containsLego(lego1.instance_id) &&
      conn.containsLego(lego2.instance_id)
  );
  const connectionsToLego1 = connections.filter(
    (conn) =>
      conn.containsLego(lego1.instance_id) &&
      !conn.containsLego(lego2.instance_id)
  );
  const connectionsToLego2 = connections.filter(
    (conn) =>
      conn.containsLego(lego2.instance_id) &&
      !conn.containsLego(lego1.instance_id)
  );

  const n_legs_lego1 = lego1.numberOfLegs;
  const n_legs_lego2 = lego2.numberOfLegs;

  // Determine which lego is Z and which is X
  const isLego1Z = lego1.type_id === Z_REP_CODE;
  const firstGroupType = isLego1Z ? X_REP_CODE : Z_REP_CODE;
  const secondGroupType = isLego1Z ? Z_REP_CODE : X_REP_CODE;

  // Create new legos for both groups
  const newLegos: DroppedLego[] = [];
  const newConnections: Connection[] = [];

  const n_group_1 = n_legs_lego1 - 1;
  const n_group_2 = n_legs_lego2 - 1;

  // Calculate required legs for each new lego
  // Each lego needs:
  // - n_legs_lego1 legs for connections to other legos in its group
  // - 1 leg for each external connection
  // - 1 leg for each dangling leg from the original lego
  const legsPerLego1 = n_group_2 + 1;
  const legsPerLego2 = n_group_1 + 1;

  // Get the maximum instance ID from existing legos
  const maxInstanceId = Math.max(
    ...droppedLegos.map((l) => parseInt(l.instance_id))
  );

  // Create first group of legos
  for (let i = 0; i < n_group_1; i++) {
    const newLego = Legos.createDynamicLego(
      firstGroupType,
      legsPerLego1,
      String(maxInstanceId + 1 + i),
      new LogicalPoint(
        lego1.logicalPosition.x + i * 100,
        lego1.logicalPosition.y + 100
      )
    );
    newLegos.push(newLego);
  }

  // Create second group of legos
  for (let i = 0; i < n_group_2; i++) {
    const newLego = Legos.createDynamicLego(
      secondGroupType,
      legsPerLego2,
      String(maxInstanceId + 1 + n_group_1 + i),
      new LogicalPoint(
        lego2.logicalPosition.x + i * 100,
        lego2.logicalPosition.y + 100
      )
    );
    newLegos.push(newLego);
  }

  // Create connections between the two groups
  for (let i = 0; i < n_group_1; i++) {
    for (let j = 0; j < n_group_2; j++) {
      newConnections.push(
        new Connection(
          {
            legoId: newLegos[i].instance_id,
            leg_index: j
          },
          {
            legoId: newLegos[n_group_1 + j].instance_id,
            leg_index: i
          }
        )
      );
    }
  }

  // Create connections for external legs
  connectionsToLego1.forEach((conn, index) => {
    const externalLegoId =
      conn.from.legoId === lego1.instance_id
        ? conn.to.legoId
        : conn.from.legoId;
    const externalLegIndex =
      conn.from.legoId === lego1.instance_id
        ? conn.to.leg_index
        : conn.from.leg_index;

    // Connect only one lego from the first group to each external lego
    newConnections.push(
      new Connection(
        {
          legoId: newLegos[index].instance_id,
          leg_index: n_group_2 // Always use the last leg index for external connections
        },
        { legoId: externalLegoId, leg_index: externalLegIndex }
      )
    );
  });

  // Create external connections for the second group
  connectionsToLego2.forEach((conn, index) => {
    const externalLegoId =
      conn.from.legoId === lego2.instance_id
        ? conn.to.legoId
        : conn.from.legoId;
    const externalLegIndex =
      conn.from.legoId === lego2.instance_id
        ? conn.to.leg_index
        : conn.from.leg_index;

    // Connect only one lego from the second group to each external lego
    newConnections.push(
      new Connection(
        {
          legoId: newLegos[n_group_1 + index].instance_id,
          leg_index: n_group_1 // Always use the last leg index for external connections
        },
        { legoId: externalLegoId, leg_index: externalLegIndex }
      )
    );
  });

  // Remove old legos and connections
  const updatedDroppedLegos = droppedLegos
    .filter(
      (lego) => !legosToCommute.some((l) => l.instance_id === lego.instance_id)
    )
    .concat(newLegos);

  const updatedConnections = connections
    .filter(
      (conn) =>
        !connectionsBetween.some(
          (c) =>
            c.from.legoId === conn.from.legoId &&
            c.from.leg_index === conn.from.leg_index &&
            c.to.legoId === conn.to.legoId &&
            c.to.leg_index === conn.to.leg_index
        ) &&
        !connectionsToLego1.some(
          (c) =>
            c.from.legoId === conn.from.legoId &&
            c.from.leg_index === conn.from.leg_index &&
            c.to.legoId === conn.to.legoId &&
            c.to.leg_index === conn.to.leg_index
        ) &&
        !connectionsToLego2.some(
          (c) =>
            c.from.legoId === conn.from.legoId &&
            c.from.leg_index === conn.from.leg_index &&
            c.to.legoId === conn.to.legoId &&
            c.to.leg_index === conn.to.leg_index
        )
    )
    .concat(newConnections);

  return {
    connections: updatedConnections,
    droppedLegos: updatedDroppedLegos,
    operation: {
      type: "bialgebra",
      data: {
        legosToRemove: legosToCommute,
        connectionsToRemove: [
          ...connectionsBetween,
          ...connectionsToLego1,
          ...connectionsToLego2
        ],
        legosToAdd: newLegos,
        connectionsToAdd: newConnections
      }
    }
  };
}
