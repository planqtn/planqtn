import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";

export class Connection {
  constructor(
    public from: {
      legoId: string;
      leg_index: number;
    },
    public to: {
      legoId: string;
      leg_index: number;
    }
  ) {}

  public equals(other: Connection): boolean {
    return (
      (this.from.legoId === other.from.legoId &&
        this.from.leg_index === other.from.leg_index &&
        this.to.legoId === other.to.legoId &&
        this.to.leg_index === other.to.leg_index) ||
      (this.from.legoId === other.to.legoId &&
        this.from.leg_index === other.to.leg_index &&
        this.to.legoId === other.from.legoId &&
        this.to.leg_index === other.from.leg_index)
    );
  }

  public containsLego(legoId: string): boolean {
    return this.from.legoId === legoId || this.to.legoId === legoId;
  }
  public containsLeg(legoId: string, leg_index: number): boolean {
    return (
      (this.from.legoId === legoId && this.from.leg_index === leg_index) ||
      (this.to.legoId === legoId && this.to.leg_index === leg_index)
    );
  }
}
export interface ConnectionSlice {
  connections: Connection[];
  getConnections: () => Connection[];
  setConnections: (connections: Connection[]) => void;
  addConnections: (connections: Connection[]) => void;
  removeConnections: (connections: Connection[]) => void;
  isLegConnected: (legoId: string, leg_index: number) => boolean;
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
            connection.from.legoId === lego.instance_id ||
            connection.to.legoId === lego.instance_id
        )
      );
    });
    // Update leg hide states after connections change
    get().updateAllLegHideStates();
  },

  addConnections: (newConnections) => {
    set((state) => {
      state.connections.push(...newConnections);
      state.connectedLegos = state.droppedLegos.filter((lego) =>
        state.connections.some(
          (connection) =>
            connection.from.legoId === lego.instance_id ||
            connection.to.legoId === lego.instance_id
        )
      );
    });
    // Update leg hide states after connections change
    get().updateAllLegHideStates();
  },

  removeConnections: (connectionsToRemove) => {
    set((state) => {
      state.connections = state.connections.filter(
        (connection) => !connectionsToRemove.includes(connection)
      );
      state.connectedLegos = state.droppedLegos.filter((lego) =>
        state.connections.some(
          (connection) =>
            connection.from.legoId === lego.instance_id ||
            connection.to.legoId === lego.instance_id
        )
      );
    });
    // Update leg hide states after connections change
    get().updateAllLegHideStates();
  },

  isLegConnected: (legoId, leg_index) => {
    return get().connections.some((connection) => {
      if (
        connection.from.legoId === legoId &&
        connection.from.leg_index === leg_index
      ) {
        return true;
      }
      if (
        connection.to.legoId === legoId &&
        connection.to.leg_index === leg_index
      ) {
        return true;
      }
      return false;
    });
  }
});
