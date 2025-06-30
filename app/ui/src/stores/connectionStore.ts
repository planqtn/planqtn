import { StateCreator } from "zustand";
import { Connection } from "../lib/types";
import { CanvasStore } from "./canvasStateStore";

export interface ConnectionSlice {
  connections: Connection[];
  getConnections: () => Connection[];
  setConnections: (connections: Connection[]) => void;
  addConnections: (connections: Connection[]) => void;
  removeConnections: (connections: Connection[]) => void;
}

export const createConnectionsSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  ConnectionSlice
> = (set, get) => ({
  connections: [],
  getConnections: () => get().connections,

  setConnections: (connections) => {
    set((state) => {
      state.connections = connections;
    });
    get().updateEncodedCanvasState();
  },

  addConnections: (newConnections) => {
    set((state) => {
      state.connections.push(...newConnections);
    });
    get().updateEncodedCanvasState();
  },

  removeConnections: (connectionsToRemove) => {
    set((state) => {
      state.connections = state.connections.filter(
        (connection) => !connectionsToRemove.includes(connection)
      );
    });
    get().updateEncodedCanvasState();
  }
});
