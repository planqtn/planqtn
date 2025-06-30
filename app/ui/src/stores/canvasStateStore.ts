import { create, StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createLegoSlice, DroppedLegosSlice } from "./droppedLegoStore";
import { ConnectionSlice, createConnectionsSlice } from "./connectionStore";
import {
  createEncodedCanvasStateSlice,
  EncodedCanvasStateSlice
} from "./encodedCanvasStateSlice";
import { Connection } from "../lib/types";
import { DroppedLego } from "./droppedLegoStore";
import {
  createOperationHistorySlice,
  OperationHistorySlice
} from "./operationHistoryStateSlice";

export interface CanvasStore
  extends DroppedLegosSlice,
    ConnectionSlice,
    EncodedCanvasStateSlice,
    GlobalTensorNetworkSlice,
    OperationHistorySlice {}

export interface GlobalTensorNetworkSlice {
  setLegosAndConnections: (
    droppedLegos: DroppedLego[],
    connections: Connection[]
  ) => void;
  getLegosAndConnections: () => {
    droppedLegos: DroppedLego[];
    connections: Connection[];
  };
}

export const createGlobalTensorNetworkStore: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  GlobalTensorNetworkSlice
> = (set, get) => ({
  setLegosAndConnections: (
    droppedLegos: DroppedLego[],
    connections: Connection[]
  ) => {
    set({ droppedLegos, connections });
    get().updateEncodedCanvasState();
  },
  getLegosAndConnections: () => {
    return { droppedLegos: get().droppedLegos, connections: get().connections };
  }
});

export const useCanvasStore = create<CanvasStore>()(
  immer((...a) => ({
    ...createConnectionsSlice(...a),
    ...createLegoSlice(...a),
    ...createEncodedCanvasStateSlice(...a),
    ...createGlobalTensorNetworkStore(...a),
    ...createOperationHistorySlice(...a)
  }))
);
