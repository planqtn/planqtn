import { Operation } from "@/features/canvas/OperationHistory";
import { Legos } from "@/features/lego/Legos";
import { Connection } from "@/stores/connectionStore";
import { DroppedLego } from "@/stores/droppedLegoStore";
import { LogicalPoint } from "@/types/coordinates";

export const canDoPullOutSameColoredLeg = (legos: DroppedLego[]) => {
  return (
    legos.length === 1 &&
    (legos[0].type_id === "x_rep_code" || legos[0].type_id === "z_rep_code")
  );
};

export const applyPullOutSameColoredLeg = (
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

  const newLego = Legos.createDynamicLego(
    lego.type_id,
    numLegs + 1,
    lego.instance_id,
    lego.logicalPosition
  );

  // Create a stopper based on the lego type
  const stopperLego: DroppedLego = new DroppedLego(
    {
      type_id: lego.type_id === "z_rep_code" ? "stopper_x" : "stopper_z",
      name: lego.type_id === "z_rep_code" ? "X Stopper" : "Z Stopper",
      short_name: lego.type_id === "z_rep_code" ? "X" : "Z",
      description: lego.type_id === "z_rep_code" ? "X Stopper" : "Z Stopper",
      parity_check_matrix: lego.type_id === "z_rep_code" ? [[1, 0]] : [[0, 1]],
      logical_legs: [],
      gauge_legs: []
    },
    new LogicalPoint(lego.logicalPosition.x + 100, lego.logicalPosition.y),
    (maxInstanceId + 1).toString()
  );

  // Create new connection to the stopper
  const newConnection: Connection = new Connection(
    {
      legoId: lego.instance_id,
      leg_index: numLegs // The new leg will be at index numLegs
    },
    {
      legoId: stopperLego.instance_id,
      leg_index: 0
    }
  );

  // Update the state
  const newLegos = [
    ...droppedLegos.filter((l) => l.instance_id !== lego.instance_id),
    newLego,
    stopperLego
  ];
  const newConnections = [
    ...connections.filter(
      (c) =>
        c.from.legoId !== lego.instance_id && c.to.legoId !== lego.instance_id
    ),
    ...existingConnections,
    newConnection
  ];

  return {
    connections: newConnections,
    droppedLegos: newLegos,
    operation: {
      type: "pullOutOppositeLeg",
      data: {
        legosToRemove: [lego],
        connectionsToRemove: [],
        legosToAdd: [newLego, stopperLego],
        connectionsToAdd: [newConnection]
      }
    }
  };
};
