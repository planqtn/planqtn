import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";

export type ConnectionEndpoint = {
  legoId: string;
  leg_index: number;
};

export type ConnectionLike = {
  from: ConnectionEndpoint;
  to: ConnectionEndpoint;
};

export class Connection {
  constructor(
    public from: ConnectionEndpoint,
    public to: ConnectionEndpoint
  ) {}

  public static equal(
    a: ConnectionLike | null | undefined,
    b: ConnectionLike | null | undefined
  ): boolean {
    if (!a?.from || !a?.to || !b?.from || !b?.to) return false;
    return (
      (a.from.legoId === b.from.legoId &&
        a.from.leg_index === b.from.leg_index &&
        a.to.legoId === b.to.legoId &&
        a.to.leg_index === b.to.leg_index) ||
      (a.from.legoId === b.to.legoId &&
        a.from.leg_index === b.to.leg_index &&
        a.to.legoId === b.from.legoId &&
        a.to.leg_index === b.from.leg_index)
    );
  }

  public equals(other: ConnectionLike): boolean {
    return Connection.equal(this, other);
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
    const oldConnections = get().connections;
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
    get().updateIsActiveForCachedTensorNetworks(
      [],
      [...oldConnections, ...connections]
    );
    get().syncSelectedTensorNetworkWithCanvas();
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
    get().updateIsActiveForCachedTensorNetworks([], newConnections);
    get().syncSelectedTensorNetworkWithCanvas();
  },

  removeConnections: (connectionsToRemove) => {
    set((state) => {
      state.connections = state.connections.filter(
        (connection) =>
          !connectionsToRemove.some((toRemove) =>
            Connection.equal(connection, toRemove)
          )
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
    get().updateIsActiveForCachedTensorNetworks([], connectionsToRemove);
    get().syncSelectedTensorNetworkWithCanvas();
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
