import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego } from "./droppedLegoStore";
import { DraggingStage } from "./legoDragState";
import { Connection } from "../lib/types";

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
        x: l.x + 20,
        y: l.y + 20
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
    const positions: { [instanceId: string]: { x: number; y: number } } = {};
    newLegos.forEach((l) => {
      positions[l.instanceId] = { x: l.x, y: l.y };
    });

    if (newLegos.length > 1) {
      get().setGroupDragState({
        legoInstanceIds: newLegos.map((l) => l.instanceId),
        originalPositions: positions
      });
    }

    // Set up initial drag state for the first lego
    // Get the current droppedLegos length to find the correct index
    const currentDroppedLegos = get().droppedLegos;
    const firstNewLegoIndex = currentDroppedLegos.length - newLegos.length;

    get().setDragState({
      draggingStage: DraggingStage.MAYBE_DRAGGING,
      draggedLegoIndex: firstNewLegoIndex,
      startX: x,
      startY: y,
      originalX: clickedLego.x + 20,
      originalY: clickedLego.y + 20
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
