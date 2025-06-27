import { Connection } from "../lib/types";
import { StateCreator } from "zustand";
import { EncodedCanvasStateSlice } from "./encodedCanvasStateSlice";

export interface ConnectionSlice {
  connections: Connection[];
  getConnections: () => Connection[];
  setConnections: (connections: Connection[]) => void;
  addConnections: (connections: Connection[]) => void;
  removeConnections: (connections: Connection[]) => void;
}

export const createConnectionsSlice: StateCreator<
  ConnectionSlice & EncodedCanvasStateSlice,
  [],
  [],
  ConnectionSlice
> = (set, get) => ({
  connections: [],
  getConnections: () => get().connections,
  setConnections: (connections: Connection[]) => {
    set({ connections });
    get().updateEncodedCanvasState();
  },
  addConnections: (newConnections: Connection[]) => {
    set((state: ConnectionSlice) => {
      return {
        connections: [...state.connections, ...newConnections]
      };
    });
    get().updateEncodedCanvasState();
  },
  removeConnections: (connections: Connection[]) => {
    set((state: ConnectionSlice) => ({
      connections: state.connections.filter(
        (connection) => !connections.includes(connection)
      )
    }));
    get().updateEncodedCanvasState();
  }
});
