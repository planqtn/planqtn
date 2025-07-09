import { StateCreator } from "zustand";
import { CanvasStateSerializer } from "../features/canvas/CanvasStateSerializer";
import { CanvasStore } from "./canvasStateStore";

export interface EncodedCanvasStateSlice {
  canvasStateSerializer: CanvasStateSerializer;
  getCanvasId: () => string;
  encodedCanvasState: string;
  hideConnectedLegs: boolean;
  decodeCanvasState: (encoded: string) => Promise<void>;
  updateEncodedCanvasState: () => void;
  getEncodedCanvasState: () => string;
  setHideConnectedLegs: (hideConnectedLegs: boolean) => void;
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

  decodeCanvasState: async (encoded: string) => {
    try {
      const result = await get().canvasStateSerializer.decode(encoded);
      set({
        droppedLegos: result.pieces,
        connections: result.connections,
        connectedLegos: result.pieces.filter((lego) =>
          result.connections.some(
            (connection) =>
              connection.from.legoId === lego.instance_id ||
              connection.to.legoId === lego.instance_id
          )
        ),
        hideConnectedLegs: result.hideConnectedLegs
      });

      // Initialize leg hide states for all legos
      result.pieces.forEach((lego) => {
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

  updateEncodedCanvasState: () => {
    const { droppedLegos, connections } = get();
    get().canvasStateSerializer.encode(
      droppedLegos,
      connections,
      get().hideConnectedLegs
    );
  },
  getEncodedCanvasState: () => get().encodedCanvasState,
  setHideConnectedLegs: (hideConnectedLegs: boolean) => {
    set({ hideConnectedLegs });
    // Update all leg hide states when the setting changes
    get().updateAllLegHideStates();
    get().updateEncodedCanvasState();
  }
});
