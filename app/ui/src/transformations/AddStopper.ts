import { Connection, DroppedLego, Operation } from "../lib/types";

export class AddStopper {
  static operationCode = "addStopper";

  constructor(
    private connections: Connection[],
    private droppedLegos: DroppedLego[],
  ) {}

  public apply(
    targetLego: DroppedLego,
    targetLegIndex: number,
    stopperLego: DroppedLego,
  ): {
    connections: Connection[];
    droppedLegos: DroppedLego[];
    operation: Operation;
  } {
    // Verify the leg is not already connected
    const isLegConnected = this.connections.some(
      (conn) =>
        (conn.from.legoId === targetLego.instanceId &&
          conn.from.legIndex === targetLegIndex) ||
        (conn.to.legoId === targetLego.instanceId &&
          conn.to.legIndex === targetLegIndex),
    );

    if (isLegConnected) {
      throw new Error("Cannot add stopper to a connected leg");
    }

    // Check if the stopper lego already exists in droppedLegos
    const existingStopperIndex = this.droppedLegos.findIndex(
      (l) => l.instanceId === stopperLego.instanceId,
    );
    let updatedLegos: DroppedLego[];

    if (existingStopperIndex !== -1) {
      // Update the existing stopper lego
      updatedLegos = this.droppedLegos.map((lego, index) =>
        index === existingStopperIndex ? stopperLego : lego,
      );
    } else {
      // Add the new stopper lego
      updatedLegos = [...this.droppedLegos, stopperLego];
    }

    // Create new connection to the stopper
    const newConnection = new Connection(
      {
        legoId: targetLego.instanceId,
        legIndex: targetLegIndex,
      },
      {
        legoId: stopperLego.instanceId,
        legIndex: 0,
      },
    );

    // Add the new connection
    const updatedConnections = [...this.connections, newConnection];

    return {
      connections: updatedConnections,
      droppedLegos: updatedLegos,
      operation: {
        type: "addStopper",
        data: {
          legosToAdd: existingStopperIndex === -1 ? [stopperLego] : [],
          legosToUpdate:
            existingStopperIndex !== -1
              ? [
                  {
                    oldLego: this.droppedLegos[existingStopperIndex],
                    newLego: stopperLego,
                  },
                ]
              : [],
          connectionsToAdd: [newConnection],
        },
      },
    };
  }
}
