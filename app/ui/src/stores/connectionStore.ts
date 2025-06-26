import { Connection } from "../lib/types";
import { create } from "zustand";

interface ConnectionStore {
  connections: Connection[];
  getConnections: () => Connection[];
  setConnections: (connections: Connection[]) => void;
  addConnections: (connections: Connection[]) => void;
  removeConnections: (connections: Connection[]) => void;
}

export const useConnectionStore = create<ConnectionStore>()((set, get) => ({
  connections: [],
  getConnections: () => get().connections,
  setConnections: (connections: Connection[]) => set({ connections }),
  addConnections: (newConnections: Connection[]) =>
    set((state: ConnectionStore) => {
      console.log("adding connections", newConnections);
      console.log("existing connections", state.connections);
      return {
        connections: [...state.connections, ...newConnections]
      };
    }),
  removeConnections: (connections: Connection[]) =>
    set((state: ConnectionStore) => ({
      connections: state.connections.filter(
        (connection) => !connections.includes(connection)
      )
    }))
}));
