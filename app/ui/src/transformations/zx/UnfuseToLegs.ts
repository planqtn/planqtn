import { Connection } from "@/stores/connectionStore.ts";
import { DroppedLego } from "@/stores/droppedLegoStore.ts";
import { LogicalPoint } from "@/types/coordinates.ts";
import { Operation } from "@/features/canvas/OperationHistory.ts";

export function canUnfuseToLegs(legos: DroppedLego[]): boolean {
  return (
    legos.length === 1 &&
    (legos[0].type_id === "x_rep_code" || legos[0].type_id === "z_rep_code")
  );
}

export function applyUnfuseToLegs(
  lego: DroppedLego,
  droppedLegos: DroppedLego[],
  connections: Connection[]
): {
  connections: Connection[];
  droppedLegos: DroppedLego[];
  operation: Operation;
} {
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

  let newLegos: DroppedLego[] = [];
  let newConnections: Connection[] = [];

  // Store the old state for history
  const oldLegos = [lego];
  const oldConnections = existingConnections;

  const d3_x_rep = [
    [1, 1, 0, 0, 0, 0], // Z stabilizers
    [0, 1, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1] // X logical
  ];
  const d3_z_rep = [
    [0, 0, 0, 1, 1, 0], // X stabilizers
    [0, 0, 0, 0, 1, 1],
    [1, 1, 1, 0, 0, 0] // Z logical
  ];

  const bell_pair = [
    [1, 1, 0, 0],
    [0, 0, 1, 1]
  ];

  const isXCode = lego.type_id === "x_rep_code";

  if (numLegs === 1) {
    // Case 1: Original lego has 1 leg -> Create 1 new lego with 2 legs
    const newLego: DroppedLego = lego.with({
      instance_id: (maxInstanceId + 1).toString(),
      logicalPosition: lego.logicalPosition.plus(new LogicalPoint(100, 0)),
      selectedMatrixRows: [],
      parity_check_matrix: bell_pair
    });
    newLegos = [lego, newLego];

    // Connect the new lego to the original connections
    if (existingConnections.length > 0) {
      const firstConnection = existingConnections[0];
      if (firstConnection.from.legoId === lego.instance_id) {
        newConnections = [
          new Connection(
            { legoId: newLego.instance_id, leg_index: 0 },
            firstConnection.to
          ),
          new Connection(
            { legoId: newLego.instance_id, leg_index: 1 },
            { legoId: lego.instance_id, leg_index: 1 }
          )
        ];
      } else {
        newConnections = [
          new Connection(firstConnection.from, {
            legoId: newLego.instance_id,
            leg_index: 0
          }),
          new Connection(
            { legoId: lego.instance_id, leg_index: 1 },
            { legoId: newLego.instance_id, leg_index: 1 }
          )
        ];
      }
    }
  } else if (numLegs === 2) {
    // Case 2: Original lego has 2 legs -> Create 1 new lego with 2 legs
    const newLego: DroppedLego = lego.with({
      instance_id: (maxInstanceId + 1).toString(),
      logicalPosition: lego.logicalPosition.plus(new LogicalPoint(100, 0)),
      selectedMatrixRows: [],
      parity_check_matrix: bell_pair
    });
    newLegos = [lego, newLego];

    // -- [0,lego,1]  - [0, new lego 1] --

    newConnections.push(
      new Connection(
        { legoId: newLego.instance_id, leg_index: 0 },
        { legoId: lego.instance_id, leg_index: 1 }
      )
    );

    // Connect the new lego to the original connections
    existingConnections.forEach((conn, index) => {
      const targetLego = index === 0 ? lego : newLego;
      const leg_index = index === 0 ? 0 : 1;

      newConnections.push(
        new Connection(
          conn.from.legoId === lego.instance_id
            ? { legoId: targetLego.instance_id, leg_index }
            : conn.from,
          conn.from.legoId === lego.instance_id
            ? conn.to
            : { legoId: targetLego.instance_id, leg_index }
        )
      );
    });
  } else if (numLegs >= 3) {
    // Case 3: Original lego has 3 or more legs -> Create n new legos in a circle
    const radius = 100; // Radius of the circle
    const center = new LogicalPoint(
      lego.logicalPosition.x,
      lego.logicalPosition.y
    );

    // First create all legos
    for (let i = 0; i < numLegs; i++) {
      const angle = (2 * Math.PI * i) / numLegs;
      const newLego: DroppedLego = lego.with({
        instance_id: (maxInstanceId + 1 + i).toString(),
        logicalPosition: center.plus(
          new LogicalPoint(radius * Math.cos(angle), radius * Math.sin(angle))
        ),
        selectedMatrixRows: [],
        parity_check_matrix: isXCode ? d3_x_rep : d3_z_rep
      });
      newLegos.push(newLego);
    }

    // Then create all connections
    for (let i = 0; i < numLegs; i++) {
      // Connect to the next lego in the circle using leg 0
      const nextIndex = (i + 1) % numLegs;
      newConnections.push(
        new Connection(
          { legoId: newLegos[i].instance_id, leg_index: 0 },
          { legoId: newLegos[nextIndex].instance_id, leg_index: 1 }
        )
      );

      // Connect the third leg (leg 2) to the original connections
      if (existingConnections[i]) {
        const conn = existingConnections[i];
        if (conn.from.legoId === lego.instance_id) {
          newConnections.push(
            new Connection(
              { legoId: newLegos[i].instance_id, leg_index: 2 },
              conn.to
            )
          );
        } else {
          newConnections.push(
            new Connection(conn.from, {
              legoId: newLegos[i].instance_id,
              leg_index: 2
            })
          );
        }
      }
    }
  }

  // Update state
  const updatedLegos = [
    ...droppedLegos.filter((l) => l.instance_id !== lego.instance_id),
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

  // Create operation for history
  const operation: Operation = {
    type: "unfuseToLegs",
    data: {
      legosToRemove: oldLegos,
      connectionsToRemove: oldConnections,
      legosToAdd: newLegos,
      connectionsToAdd: newConnections
    }
  };

  return {
    connections: updatedConnections,
    droppedLegos: updatedLegos,
    operation
  };
}
