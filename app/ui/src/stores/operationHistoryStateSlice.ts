import { StateCreator } from "zustand";
import { OperationHistory } from "../lib/OperationHistory";
import { DroppedLegosSlice } from "./droppedLegoStore";
import { ConnectionSlice } from "./connectionStore";
import { Operation } from "../lib/types";
import { GlobalTensorNetworkSlice } from "./canvasStateStore";

export interface OperationHistorySlice {
  addOperation: (operation: Operation) => void;
  undo: () => void;
  redo: () => void;
}

export const createOperationHistorySlice: StateCreator<
  OperationHistorySlice &
    ConnectionSlice &
    DroppedLegosSlice &
    GlobalTensorNetworkSlice,
  [],
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
