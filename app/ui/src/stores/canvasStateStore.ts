import { create, StateCreator } from "zustand";
import { createLegoSlice, DroppedLegosSlice } from "./droppedLegoStore";
import { ConnectionSlice, createConnectionsSlice } from "./connectionStore";
import {
  createEncodedCanvasStateSlice,
  EncodedCanvasStateSlice
} from "./encodedCanvasStateSlice";
import { Connection, DroppedLego } from "../lib/types";

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
  DroppedLegosSlice & ConnectionSlice & EncodedCanvasStateSlice,
  [],
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

export const useCanvasStore = create<
  DroppedLegosSlice &
    ConnectionSlice &
    EncodedCanvasStateSlice &
    GlobalTensorNetworkSlice
>((...a) => ({
  ...createConnectionsSlice(...a),
  ...createLegoSlice(...a),
  ...createEncodedCanvasStateSlice(...a),
  ...createGlobalTensorNetworkStore(...a)
}));
