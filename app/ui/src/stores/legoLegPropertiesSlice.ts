import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego } from "./droppedLegoStore";
import { Connection } from "../lib/types";

export interface LegoLegPropertiesSlice {
  // Object mapping lego instance ID to array of boolean hide states for each leg
  legHideStates: Record<string, boolean[]>;

  // Object mapping lego instance ID to array of boolean connection states for each leg
  legConnectionStates: Record<string, boolean[]>;

  // Object mapping connection key to boolean indicating if connected legs have same highlight color
  connectionHighlightStates: Record<string, boolean>;

  // Object mapping lego instance ID to array of Connection objects that involve this lego
  legoConnectionMap: Record<string, Connection[]>;

  // Initialize leg hide states for a lego
  initializeLegHideStates: (legoId: string, numLegs: number) => void;

  // Update leg hide states for a specific lego
  updateLegHideStates: (legoId: string, hideStates: boolean[]) => void;

  // Get leg hide states for a specific lego
  getLegHideStates: (legoId: string) => boolean[];

  // Initialize leg connection states for a lego
  initializeLegConnectionStates: (legoId: string, numLegs: number) => void;

  // Get leg connection states for a specific lego
  getLegConnectionStates: (legoId: string) => boolean[];

  // Get connection highlight state for a specific connection
  getConnectionHighlightState: (connectionKey: string) => boolean;

  // Get connections for a specific lego
  getLegoConnections: (legoId: string) => Connection[];

  // Update all leg hide states based on current connections and settings
  updateAllLegHideStates: () => void;

  // Update all leg connection states based on current connections
  updateAllLegConnectionStates: () => void;

  // Update all connection highlight states based on current connections
  updateAllConnectionHighlightStates: () => void;

  // Update per-lego connection mapping
  updateLegoConnectionMap: () => void;

  // Remove leg hide states for a lego (when lego is deleted)
  removeLegHideStates: (legoId: string) => void;

  // Remove leg connection states for a lego (when lego is deleted)
  removeLegConnectionStates: (legoId: string) => void;

  // Remove lego from connection map (when lego is deleted)
  removeLegoFromConnectionMap: (legoId: string) => void;

  // Clear all leg hide states
  clearAllLegHideStates: () => void;

  // Clear all leg connection states
  clearAllLegConnectionStates: () => void;

  // Clear all connection highlight states
  clearAllConnectionHighlightStates: () => void;

  // Clear all lego connection mappings
  clearLegoConnectionMap: () => void;
}

export const createLegoLegPropertiesSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  LegoLegPropertiesSlice
> = (set, get) => {
  // Helper function to calculate hide state for a single leg
  // This is extracted from the original shouldHideLeg logic
  const calculateLegHideState = (
    lego: DroppedLego,
    legIndex: number,
    connections: Connection[]
  ): boolean => {
    const isConnected = connections.some((connection) => {
      if (
        connection.from.legoId === lego.instanceId &&
        connection.from.legIndex === legIndex
      ) {
        return true;
      }
      if (
        connection.to.legoId === lego.instanceId &&
        connection.to.legIndex === legIndex
      ) {
        return true;
      }
      return false;
    });

    if (!isConnected) return false;

    const thisLegStyle = lego.style!.legStyles[legIndex];
    const isThisHighlighted = thisLegStyle.is_highlighted;

    // If this leg is not highlighted, hide it only if connected to a non-highlighted leg
    if (!isThisHighlighted) {
      // Check if connected to a highlighted leg
      return !connections.some((conn) => {
        if (
          conn.from.legoId === lego.instanceId &&
          conn.from.legIndex === legIndex
        ) {
          // Get connected lego from store
          const connectedLego = get().droppedLegos.find(
            (l) => l.instanceId === conn.to.legoId
          );
          return (
            connectedLego?.style!.legStyles[conn.to.legIndex].is_highlighted ||
            false
          );
        }
        if (
          conn.to.legoId === lego.instanceId &&
          conn.to.legIndex === legIndex
        ) {
          // Get connected lego from store
          const connectedLego = get().droppedLegos.find(
            (l) => l.instanceId === conn.from.legoId
          );
          return (
            connectedLego?.style!.legStyles[conn.from.legIndex]
              .is_highlighted || false
          );
        }
        return false;
      });
    }

    // If this leg is highlighted, hide it only if connected to a leg with the same highlight color
    return connections.some((conn) => {
      if (
        conn.from.legoId === lego.instanceId &&
        conn.from.legIndex === legIndex
      ) {
        // Get connected lego from store
        const connectedLego = get().droppedLegos.find(
          (l) => l.instanceId === conn.to.legoId
        );
        const connectedStyle =
          connectedLego?.style!.legStyles[conn.to.legIndex];
        return (
          connectedStyle?.is_highlighted &&
          connectedStyle.color === thisLegStyle.color
        );
      }
      if (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex) {
        // Get connected lego from store
        const connectedLego = get().droppedLegos.find(
          (l) => l.instanceId === conn.from.legoId
        );
        const connectedStyle =
          connectedLego?.style!.legStyles[conn.from.legIndex];
        return (
          connectedStyle?.is_highlighted &&
          connectedStyle.color === thisLegStyle.color
        );
      }
      return false;
    });
  };

  return {
    legHideStates: {},
    legConnectionStates: {},
    connectionHighlightStates: {},
    legoConnectionMap: {},

    initializeLegHideStates: (legoId: string, numLegs: number) => {
      set((state) => {
        if (!state.legHideStates) {
          state.legHideStates = {};
        }
        state.legHideStates[legoId] = new Array(numLegs).fill(false);
      });
    },

    updateLegHideStates: (legoId: string, hideStates: boolean[]) => {
      set((state) => {
        if (!state.legHideStates) {
          state.legHideStates = {};
        }
        state.legHideStates[legoId] = [...hideStates];
      });
    },

    getLegHideStates: (legoId: string) => {
      return get().legHideStates[legoId] || [];
    },

    initializeLegConnectionStates: (legoId: string, numLegs: number) => {
      set((state) => {
        if (!state.legConnectionStates) {
          state.legConnectionStates = {};
        }
        state.legConnectionStates[legoId] = new Array(numLegs).fill(false);
      });
    },

    getLegConnectionStates: (legoId: string) => {
      return get().legConnectionStates[legoId] || [];
    },

    getConnectionHighlightState: (connectionKey: string) => {
      return get().connectionHighlightStates[connectionKey] || false;
    },

    getLegoConnections: (legoId: string) => {
      return get().legoConnectionMap[legoId] || [];
    },

    updateAllLegHideStates: () => {
      const { droppedLegos, connections, hideConnectedLegs } = get();

      set((state) => {
        if (!state.legHideStates) {
          state.legHideStates = {};
        }

        // Update hide states for each lego
        droppedLegos.forEach((lego) => {
          const hideStates = new Array(lego.numberOfLegs).fill(false);

          // Only calculate hide states if the feature is enabled and lego doesn't always show legs
          if (hideConnectedLegs && !lego.alwaysShowLegs) {
            for (let legIndex = 0; legIndex < lego.numberOfLegs; legIndex++) {
              hideStates[legIndex] = calculateLegHideState(
                lego,
                legIndex,
                connections
              );
            }
          }

          state.legHideStates[lego.instanceId] = hideStates;
        });
      });

      // Also update connection states since they're related
      get().updateAllLegConnectionStates();
      // Also update connection highlight states since they're related
      get().updateAllConnectionHighlightStates();
      // Also update lego connection map since it's related
      get().updateLegoConnectionMap();
    },

    updateAllLegConnectionStates: () => {
      const { droppedLegos, connections } = get();

      set((state) => {
        if (!state.legConnectionStates) {
          state.legConnectionStates = {};
        }

        // Update connection states for each lego
        droppedLegos.forEach((lego) => {
          const connectionStates = new Array(lego.numberOfLegs).fill(false);

          // Only calculate connection states if the feature is enabled and lego doesn't always show legs
          if (!lego.alwaysShowLegs) {
            for (let legIndex = 0; legIndex < lego.numberOfLegs; legIndex++) {
              connectionStates[legIndex] = connections.some((conn) => {
                if (
                  conn.from.legoId === lego.instanceId &&
                  conn.from.legIndex === legIndex
                ) {
                  return true;
                }
                if (
                  conn.to.legoId === lego.instanceId &&
                  conn.to.legIndex === legIndex
                ) {
                  return true;
                }
                return false;
              });
            }
          }

          state.legConnectionStates[lego.instanceId] = connectionStates;
        });
      });
    },

    updateAllConnectionHighlightStates: () => {
      const { droppedLegos, connections } = get();

      set((state) => {
        if (!state.connectionHighlightStates) {
          state.connectionHighlightStates = {};
        }

        // Clear existing states
        state.connectionHighlightStates = {};

        // Calculate highlight states for each connection
        connections.forEach((conn) => {
          const fromLego = droppedLegos.find(
            (l) => l.instanceId === conn.from.legoId
          );
          const toLego = droppedLegos.find(
            (l) => l.instanceId === conn.to.legoId
          );

          if (!fromLego || !toLego) return;

          const fromLegStyle = fromLego.style!.legStyles[conn.from.legIndex];
          const toLegStyle = toLego.style!.legStyles[conn.to.legIndex];

          // Create a stable connection key
          const [firstId, firstLeg, secondId, secondLeg] =
            conn.from.legoId < conn.to.legoId
              ? [
                  conn.from.legoId,
                  conn.from.legIndex,
                  conn.to.legoId,
                  conn.to.legIndex
                ]
              : [
                  conn.to.legoId,
                  conn.to.legIndex,
                  conn.from.legoId,
                  conn.from.legIndex
                ];
          const connectionKey = `${firstId}-${firstLeg}-${secondId}-${secondLeg}`;

          // Check if both legs are highlighted and have the same color
          const colorsMatch =
            fromLegStyle.is_highlighted &&
            toLegStyle.is_highlighted &&
            fromLegStyle.color === toLegStyle.color;

          state.connectionHighlightStates[connectionKey] = colorsMatch;
        });
      });
    },

    updateLegoConnectionMap: () => {
      const { droppedLegos, connections } = get();
      set((state) => {
        if (!state.legoConnectionMap) {
          state.legoConnectionMap = {};
        }
        // Only update the array for a lego if its connections actually changed
        for (const lego of droppedLegos) {
          const newConnections = connections.filter(
            (conn) =>
              conn.from.legoId === lego.instanceId ||
              conn.to.legoId === lego.instanceId
          );
          const prevConnections = state.legoConnectionMap[lego.instanceId];
          // Only replace if changed (shallow compare)
          if (
            !prevConnections ||
            prevConnections.length !== newConnections.length ||
            prevConnections.some((c, i) => c !== newConnections[i])
          ) {
            state.legoConnectionMap[lego.instanceId] = newConnections;
          }
          // else: keep the same array reference!
        }
      });
    },

    removeLegHideStates: (legoId: string) => {
      set((state) => {
        if (state.legHideStates) {
          delete state.legHideStates[legoId];
        }
      });
    },

    removeLegConnectionStates: (legoId: string) => {
      set((state) => {
        if (state.legConnectionStates) {
          delete state.legConnectionStates[legoId];
        }
      });
    },

    removeLegoFromConnectionMap: (legoId: string) => {
      set((state) => {
        if (state.legoConnectionMap) {
          delete state.legoConnectionMap[legoId];
        }
      });
    },

    clearAllLegHideStates: () => {
      set((state) => {
        state.legHideStates = {};
      });
    },

    clearAllLegConnectionStates: () => {
      set((state) => {
        state.legConnectionStates = {};
      });
    },

    clearAllConnectionHighlightStates: () => {
      set((state) => {
        state.connectionHighlightStates = {};
      });
    },

    clearLegoConnectionMap: () => {
      set((state) => {
        state.legoConnectionMap = {};
      });
    }
  };
};
