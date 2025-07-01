import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego } from "./droppedLegoStore";
import { Connection } from "../lib/types";

export interface LegoLegPropertiesSlice {
  // Object mapping lego instance ID to array of boolean hide states for each leg
  legHideStates: Record<string, boolean[]>;

  // Initialize leg hide states for a lego
  initializeLegHideStates: (legoId: string, numLegs: number) => void;

  // Update leg hide states for a specific lego
  updateLegHideStates: (legoId: string, hideStates: boolean[]) => void;

  // Get leg hide states for a specific lego
  getLegHideStates: (legoId: string) => boolean[];

  // Update all leg hide states based on current connections and settings
  updateAllLegHideStates: () => void;

  // Remove leg hide states for a lego (when lego is deleted)
  removeLegHideStates: (legoId: string) => void;

  // Clear all leg hide states
  clearAllLegHideStates: () => void;
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
    },

    removeLegHideStates: (legoId: string) => {
      set((state) => {
        if (state.legHideStates) {
          delete state.legHideStates[legoId];
        }
      });
    },

    clearAllLegHideStates: () => {
      set((state) => {
        state.legHideStates = {};
      });
    }
  };
};
