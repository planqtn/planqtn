import { StateCreator } from "zustand";
import { OperationHistory } from "../features/canvas/OperationHistory.ts";
import { Operation } from "../features/canvas/OperationHistory.ts";
import { CanvasStore } from "./canvasStateStore";

export interface OperationHistorySlice {
  addOperation: (operation: Operation) => void;
  undo: () => void;
  redo: () => void;
}

export const createOperationHistorySlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  OperationHistorySlice
> = (_, get) => {
  // Private instance
  const operationHistory = new OperationHistory([]);

  return {
    addOperation: (operation: Operation) => {
      operationHistory.addOperation(operation);
    },
    undo: () => {
      const { connections, droppedLegos } = get().getLegosAndConnections();
      const { connections: newConnections, droppedLegos: newDroppedLegos } =
        operationHistory.undo(connections, droppedLegos);
      get().setLegosAndConnections(newDroppedLegos, newConnections);
    },
    redo: () => {
      const { connections, droppedLegos } = get().getLegosAndConnections();
      const { connections: newConnections, droppedLegos: newDroppedLegos } =
        operationHistory.redo(connections, droppedLegos);
      get().setLegosAndConnections(newDroppedLegos, newConnections);
    }
  };
};
