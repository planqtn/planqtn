import { StateCreator } from "zustand";
import { Connection } from "../lib/types";
import { CanvasStore } from "./canvasStateStore";

export interface ConnectionSlice {
  connections: Connection[];
  getConnections: () => Connection[];
  setConnections: (connections: Connection[]) => void;
  addConnections: (connections: Connection[]) => void;
  removeConnections: (connections: Connection[]) => void;
  isLegConnected: (legoId: string, legIndex: number) => boolean;
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
      state.connectedLegos = state.droppedLegos.filter((lego) =>
        state.connections.some(
          (connection) =>
            connection.from.legoId === lego.instanceId ||
            connection.to.legoId === lego.instanceId
        )
      );
    });
    // Update leg hide states after connections change
    get().updateAllLegHideStates();
    get().updateEncodedCanvasState();
  },

  addConnections: (newConnections) => {
    set((state) => {
      state.connections.push(...newConnections);
      state.connectedLegos = state.droppedLegos.filter((lego) =>
        state.connections.some(
          (connection) =>
            connection.from.legoId === lego.instanceId ||
            connection.to.legoId === lego.instanceId
        )
      );
    });
    // Update leg hide states after connections change
    get().updateAllLegHideStates();
    get().updateEncodedCanvasState();
  },

  removeConnections: (connectionsToRemove) => {
    set((state) => {
      state.connections = state.connections.filter(
        (connection) => !connectionsToRemove.includes(connection)
      );
      state.connectedLegos = state.droppedLegos.filter((lego) =>
        state.connections.some(
          (connection) =>
            connection.from.legoId === lego.instanceId ||
            connection.to.legoId === lego.instanceId
        )
      );
    });
    // Update leg hide states after connections change
    get().updateAllLegHideStates();
    get().updateEncodedCanvasState();
  },

  isLegConnected: (legoId, legIndex) => {
    return get().connections.some((connection) => {
      if (
        connection.from.legoId === legoId &&
        connection.from.legIndex === legIndex
      ) {
        return true;
      }
      if (
        connection.to.legoId === legoId &&
        connection.to.legIndex === legIndex
      ) {
        return true;
      }
      return false;
    });
  }
});
