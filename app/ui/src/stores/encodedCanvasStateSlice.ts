import { StateCreator } from "zustand";
import { ConnectionSlice } from "./connectionStore";
import { DroppedLegosSlice } from "./droppedLegoStore";
import { CanvasStateSerializer } from "../lib/CanvasStateSerializer";

const canvasStateSerializer = new CanvasStateSerializer();

export interface EncodedCanvasStateSlice {
  canvasId: string;
  encodedCanvasState: string;
  hideConnectedLegs: boolean;
  decodeCanvasState: (encoded: string) => Promise<void>;
  updateEncodedCanvasState: () => void;
  getEncodedCanvasState: () => string;
  setHideConnectedLegs: (hideConnectedLegs: boolean) => void;
}

export const createEncodedCanvasStateSlice: StateCreator<
  EncodedCanvasStateSlice & ConnectionSlice & DroppedLegosSlice,
  [],
  [],
  EncodedCanvasStateSlice
> = (set, get) => ({
  canvasId: canvasStateSerializer.getCanvasId(),
  encodedCanvasState: "",
  hideConnectedLegs: false,

  decodeCanvasState: async (encoded: string) => {
    try {
      const result = await canvasStateSerializer.decode(encoded);
      set({
        canvasId: result.canvasId,
        droppedLegos: result.pieces,
        connections: result.connections
      });
      console.log("Decoded canvas state for canvasId:", result.canvasId);
      console.log(new Error().stack);
    } catch (error) {
      console.error("Failed to decode canvas state:", error);
      if (error instanceof Error) console.log(error.stack);
      // Create a new error with a user-friendly message
      throw error;
    }
  },

  updateEncodedCanvasState: () => {
    const { droppedLegos, connections } = get();
    canvasStateSerializer.encode(
      droppedLegos,
      connections,
      get().hideConnectedLegs
    );
  },
  getEncodedCanvasState: () => get().encodedCanvasState,
  setHideConnectedLegs: (hideConnectedLegs: boolean) => {
    set({ hideConnectedLegs });
    get().updateEncodedCanvasState();
  }
});
