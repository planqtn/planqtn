import { StateCreator } from "zustand";
import { CanvasStateSerializer } from "../features/canvas/CanvasStateSerializer";
import { CanvasStore } from "./canvasStateStore";

export interface EncodedCanvasStateSlice {
  canvasStateSerializer: CanvasStateSerializer;
  getCanvasId: () => string;
  encodedCanvasState: string;
  hideConnectedLegs: boolean;
  hideIds: boolean;
  hideTypeIds: boolean;
  hideDanglingLegs: boolean;
  hideLegLabels: boolean;

  decodeCanvasState: (encoded: string) => Promise<void>;
  getEncodedCanvasState: () => string;
  setHideConnectedLegs: (hideConnectedLegs: boolean) => void;
  setHideIds: (hideIds: boolean) => void;
  setHideTypeIds: (hideTypeIds: boolean) => void;
  setHideDanglingLegs: (hideDanglingLegs: boolean) => void;
  setHideLegLabels: (hideLegLabels: boolean) => void;
}

export const createEncodedCanvasStateSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  EncodedCanvasStateSlice
> = (set, get) => ({
  canvasStateSerializer: new CanvasStateSerializer(),
  getCanvasId: () => get().canvasStateSerializer.getCanvasId(),
  encodedCanvasState: "",
  hideConnectedLegs: true,
  hideIds: false,
  hideTypeIds: false,
  hideDanglingLegs: false,
  hideLegLabels: false,

  decodeCanvasState: async (encoded: string) => {
    try {
      const result = await get().canvasStateSerializer.decode(encoded);
      set({
        droppedLegos: result.droppedLegos,
        connections: result.connections,
        connectedLegos: result.droppedLegos.filter((lego) =>
          result.connections.some(
            (connection) =>
              connection.from.legoId === lego.instance_id ||
              connection.to.legoId === lego.instance_id
          )
        ),
        hideConnectedLegs: result.hideConnectedLegs,
        hideIds: result.hideIds,
        hideTypeIds: result.hideTypeIds,
        hideDanglingLegs: result.hideDanglingLegs,
        hideLegLabels: result.hideLegLabels
      });

      // Initialize leg hide states for all legos
      result.droppedLegos.forEach((lego) => {
        get().initializeLegHideStates(lego.instance_id, lego.numberOfLegs);
        get().initializeLegConnectionStates(
          lego.instance_id,
          lego.numberOfLegs
        );
      });

      // Update all leg hide states based on the loaded connections
      get().updateAllLegHideStates();
    } catch (error) {
      console.error("Failed to decode canvas state:", error);
      if (error instanceof Error) console.log(error.stack);
      // Create a new error with a user-friendly message
      throw error;
    }
  },

  getEncodedCanvasState: () => get().encodedCanvasState,
  setHideConnectedLegs: (hideConnectedLegs: boolean) => {
    set({ hideConnectedLegs });
    // Update all leg hide states when the setting changes
    get().updateAllLegHideStates();
  },
  setHideIds: (hideIds: boolean) => {
    set({ hideIds });
  },
  setHideTypeIds: (hideTypeIds: boolean) => {
    set({ hideTypeIds });
  },
  setHideDanglingLegs: (hideDanglingLegs: boolean) => {
    set({ hideDanglingLegs });
    get().updateAllLegHideStates();
  },
  setHideLegLabels: (hideLegLabels: boolean) => {
    set({ hideLegLabels });
  }
});
