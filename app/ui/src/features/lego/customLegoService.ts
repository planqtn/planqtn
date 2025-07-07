import { useCanvasStore } from "../../stores/canvasStateStore";
import { CanvasStateSerializer } from "../canvas/CanvasStateSerializer";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { LogicalPoint } from "../../types/coordinates";

export interface CustomLegoCreationOptions {
  stateSerializer?: CanvasStateSerializer;
  hideConnectedLegs?: boolean;
}

export class CustomLegoService {
  static createCustomLego(
    matrix: number[][],
    logicalLegs: number[],
    position: { x: number; y: number }
  ): void {
    const { addDroppedLego, addOperation, newInstanceId } =
      useCanvasStore.getState();

    const instanceId = newInstanceId();
    const newLego: DroppedLego = new DroppedLego(
      {
        // Generate unique ID to avoid caching collisions
        id:
          "custom-" +
          instanceId +
          "-" +
          Math.random().toString(36).substring(2, 15),
        name: "Custom Lego",
        shortName: "Custom",
        description: "Custom lego with user-defined parity check matrix",
        parity_check_matrix: matrix,
        logical_legs: logicalLegs,
        gauge_legs: []
      },

      new LogicalPoint(position.x, position.y),
      instanceId
    );

    // Add to store
    addDroppedLego(newLego);

    addOperation({
      type: "add",
      data: {
        legosToAdd: [newLego]
      }
    });
  }
}
