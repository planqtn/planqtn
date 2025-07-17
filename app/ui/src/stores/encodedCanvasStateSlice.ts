import { StateCreator } from "zustand";
import {
  CanvasStateSerializer,
  CompressedCanvasState
} from "../features/canvas/CanvasStateSerializer";
import { CanvasStore, getCanvasIdFromUrl } from "./canvasStateStore";
import * as LZString from "lz-string";

export interface EncodedCanvasStateSlice {
  canvasStateSerializer: CanvasStateSerializer;
  getCanvasId: () => string;
  encodedCanvasState: string;
  title: string;
  hideConnectedLegs: boolean;
  hideIds: boolean;
  hideTypeIds: boolean;
  hideDanglingLegs: boolean;
  hideLegLabels: boolean;

  decodeCanvasState: (encoded: string) => Promise<void>;
  rehydrateCanvasState: (jsonString: string) => Promise<void>;
  getEncodedCanvasState: () => string;
  setTitle: (title: string) => void;
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
  canvasStateSerializer: new CanvasStateSerializer(getCanvasIdFromUrl()),
  getCanvasId: () => get().canvasStateSerializer.getCanvasId(),
  encodedCanvasState: "",
  title: "",
  hideConnectedLegs: true,
  hideIds: false,
  hideTypeIds: false,
  hideDanglingLegs: false,
  hideLegLabels: false,
  decodeCanvasState: async (encoded: string) => {
    try {
      // Try to decode as compressed format first (new format)
      const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
      if (decompressed) {
        try {
          // Try to parse as compressed array format
          const parsedData = JSON.parse(decompressed);
          if (Array.isArray(parsedData) && parsedData.length >= 7) {
            // This is the new compressed format
            const serializer = get().canvasStateSerializer;
            const standardFormat = serializer.fromCompressedCanvasState(
              parsedData as CompressedCanvasState
            );
            const jsonString = JSON.stringify(standardFormat);
            get().rehydrateCanvasState(jsonString);
            return;
          } else {
            // This is legacy JSON format with lz-string compression
            get().rehydrateCanvasState(decompressed);
            return;
          }
        } catch {
          // If JSON parsing fails, treat as raw string
          get().rehydrateCanvasState(decompressed);
          return;
        }
      }
    } catch (error) {
      console.log(
        "Failed to decode as lz-string, trying legacy base64 format",
        error
      );
    }

    try {
      // Fall back to legacy base64 format for backward compatibility
      const decoded = atob(encoded);
      get().rehydrateCanvasState(decoded);
    } catch (error) {
      console.error("Failed to decode canvas state:", error);
      throw new Error("Invalid canvas state format");
    }
  },

  rehydrateCanvasState: async (jsonString: string) => {
    try {
      const result = await get().canvasStateSerializer.rehydrate(jsonString);
      console.log("rehydration result", result);
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
        title: result.title,
        hideConnectedLegs: result.hideConnectedLegs,
        hideIds: result.hideIds,
        hideTypeIds: result.hideTypeIds,
        hideDanglingLegs: result.hideDanglingLegs,
        hideLegLabels: result.hideLegLabels,
        viewport: result.viewport,
        parityCheckMatrices: result.parityCheckMatrices,
        weightEnumerators: result.weightEnumerators,
        highlightedTensorNetworkLegs: result.highlightedTensorNetworkLegs,
        selectedTensorNetworkParityCheckMatrixRows:
          result.selectedTensorNetworkParityCheckMatrixRows
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
      console.error("Error rehydrating canvas state:", error);
      throw error;
    }
  },

  getEncodedCanvasState: () => {
    const serialized =
      get().canvasStateSerializer.toSerializableCanvasState(get());
    const jsonString = JSON.stringify(serialized);
    // Use lz-string compression for better compression ratio
    return LZString.compressToEncodedURIComponent(jsonString);
  },

  setTitle: (title: string) => {
    set({ title });
  },

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
