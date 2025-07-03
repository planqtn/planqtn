import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";

export class Connection {
  constructor(
    public from: {
      legoId: string;
      legIndex: number;
    },
    public to: {
      legoId: string;
      legIndex: number;
    }
  ) {}

  public equals(other: Connection): boolean {
    return (
      (this.from.legoId === other.from.legoId &&
        this.from.legIndex === other.from.legIndex &&
        this.to.legoId === other.to.legoId &&
        this.to.legIndex === other.to.legIndex) ||
      (this.from.legoId === other.to.legoId &&
        this.from.legIndex === other.to.legIndex &&
        this.to.legoId === other.from.legoId &&
        this.to.legIndex === other.from.legIndex)
    );
  }

  public containsLego(legoId: string): boolean {
    return this.from.legoId === legoId || this.to.legoId === legoId;
  }
  public containsLeg(legoId: string, legIndex: number): boolean {
    return (
      (this.from.legoId === legoId && this.from.legIndex === legIndex) ||
      (this.to.legoId === legoId && this.to.legIndex === legIndex)
    );
  }
}
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
