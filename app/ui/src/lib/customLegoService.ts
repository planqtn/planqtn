import { DroppedLego } from "./types";
import { getLegoStyle } from "../LegoStyles";
import { useCanvasStore } from "../stores/canvasStateStore";
import { OperationHistory } from "./OperationHistory";
import { CanvasStateSerializer } from "./CanvasStateSerializer";

export interface CustomLegoCreationOptions {
  operationHistory?: OperationHistory;
  stateSerializer?: CanvasStateSerializer;
  hideConnectedLegs?: boolean;
  newInstanceId?: () => string;
}

export class CustomLegoService {
  static createCustomLego(
    matrix: number[][],
    logicalLegs: number[],
    position: { x: number; y: number },
    options: CustomLegoCreationOptions
  ): void {
    const { addDroppedLego } = useCanvasStore.getState();

    const instanceId = options.newInstanceId ? options.newInstanceId() : "1";
    const newLego: DroppedLego = {
      // Generate unique ID to avoid caching collisions
      id:
        "custom-" +
        instanceId +
        "-" +
        Math.random().toString(36).substring(2, 15),
      name: "Custom Lego",
      shortName: "Custom",
      description: "Custom lego with user-defined parity check matrix",
      instanceId: instanceId,
      x: position.x,
      y: position.y,
      parity_check_matrix: matrix,
      logical_legs: logicalLegs,
      gauge_legs: [],
      style: getLegoStyle("custom", matrix[0].length / 2),
      selectedMatrixRows: []
    };

    // Add to store
    addDroppedLego(newLego);

    // Add to operation history if provided
    if (options.operationHistory) {
      options.operationHistory.addOperation({
        type: "add",
        data: {
          legosToAdd: [newLego]
        }
      });
    }
  }
}
