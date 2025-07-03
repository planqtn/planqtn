import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego } from "./droppedLegoStore";
import { DraggingStage } from "./legoDragState";
import { Connection } from "./connectionStore";
import { LogicalPoint, WindowPoint } from "../types/coordinates";

export interface CloningSlice {
  handleClone: (lego: DroppedLego, x: number, y: number) => void;
}

export const useCloningSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  CloningSlice
> = (_, get) => ({
  handleClone: (clickedLego, x, y) => {
    const tensorNetwork = get().tensorNetwork;
    const connections = get().connections;
    const isSelected =
      tensorNetwork &&
      tensorNetwork?.legos.some((l) => l.instanceId === clickedLego.instanceId);

    const cloneOffset = new LogicalPoint(20, 20);
    // Check if we're cloning multiple legos
    const legosToClone = isSelected ? tensorNetwork?.legos : [clickedLego];

    // Get a single starting ID for all new legos
    const startingId = parseInt(get().newInstanceId());

    // Create a mapping from old instance IDs to new ones
    const instanceIdMap = new Map<string, string>();
    const newLegos = legosToClone.map((l, idx) => {
      const newId = String(startingId + idx);
      instanceIdMap.set(l.instanceId, newId);
      return l.with({
        instanceId: newId,
        logicalPosition: l.logicalPosition.plus(cloneOffset)
      });
    });

    // Clone connections between the selected legos
    const newConnections = connections
      .filter(
        (conn) =>
          legosToClone.some((l) => l.instanceId === conn.from.legoId) &&
          legosToClone.some((l) => l.instanceId === conn.to.legoId)
      )
      .map(
        (conn) =>
          new Connection(
            {
              legoId: instanceIdMap.get(conn.from.legoId)!,
              legIndex: conn.from.legIndex
            },
            {
              legoId: instanceIdMap.get(conn.to.legoId)!,
              legIndex: conn.to.legIndex
            }
          )
      );

    // Add new legos and connections
    get().addDroppedLegos(newLegos);
    get().addConnections(newConnections);

    // Set up drag state for the group
    const positions: { [instanceId: string]: LogicalPoint } = {};
    newLegos.forEach((l) => {
      positions[l.instanceId] = l.logicalPosition;
    });

    if (newLegos.length > 1) {
      get().setGroupDragState({
        legoInstanceIds: newLegos.map((l) => l.instanceId),
        originalPositions: positions
      });
    }

    get().setLegoDragState({
      draggingStage: DraggingStage.MAYBE_DRAGGING,
      draggedLegoInstanceId: newLegos[0].instanceId,
      startMouseWindowPoint: new WindowPoint(x, y),
      startLegoLogicalPoint: clickedLego.logicalPosition.plus(
        new LogicalPoint(20, 20)
      )
    });

    // Add to history
    get().addOperation({
      type: "add",
      data: {
        legosToAdd: newLegos,
        connectionsToAdd: newConnections
      }
    });
  }
});
