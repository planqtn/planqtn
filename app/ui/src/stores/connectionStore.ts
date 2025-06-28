import { StateCreator } from "zustand";
import { produce } from "immer";
import { Connection } from "../lib/types";
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

  setConnections: (connections) => {
    set(
      produce((state: ConnectionSlice) => {
        state.connections = connections;
      })
    );
    get().updateEncodedCanvasState();
  },

  addConnections: (newConnections) => {
    set(
      produce((state: ConnectionSlice) => {
        state.connections.push(...newConnections);
      })
    );
    get().updateEncodedCanvasState();
  },

  removeConnections: (connectionsToRemove) => {
    set(
      produce((state: ConnectionSlice) => {
        state.connections = state.connections.filter(
          (connection) => !connectionsToRemove.includes(connection)
        );
      })
    );
    get().updateEncodedCanvasState();
  }
});
