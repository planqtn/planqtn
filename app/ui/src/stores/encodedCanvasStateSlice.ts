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
              connection.from.legoId === lego.instanceId ||
              connection.to.legoId === lego.instanceId
          )
        ),
        hideConnectedLegs: result.hideConnectedLegs
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
    get().canvasStateSerializer.encode(
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
