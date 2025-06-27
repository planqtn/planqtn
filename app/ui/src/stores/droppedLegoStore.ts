import { StateCreator } from "zustand";
import { DroppedLego } from "../lib/types";
import { EncodedCanvasStateSlice } from "./encodedCanvasStateSlice";

export interface DroppedLegosSlice {
  droppedLegos: DroppedLego[];

  setDroppedLegos: (
    legos: DroppedLego[] | ((prev: DroppedLego[]) => DroppedLego[])
  ) => void;
  addDroppedLego: (lego: DroppedLego) => void;
  addDroppedLegos: (legos: DroppedLego[]) => void;
  removeDroppedLego: (instanceId: string) => void;
  updateDroppedLego: (
    instanceId: string,
    updates: Partial<DroppedLego>
  ) => void;
  removeDroppedLegos: (instanceIds: string[]) => void;
  clearDroppedLegos: () => void;
  newInstanceId: () => string;
}

export const createLegoSlice: StateCreator<
  DroppedLegosSlice & EncodedCanvasStateSlice,
  [],
  [],
  DroppedLegosSlice
> = (set, get) => ({
  droppedLegos: [],
  newInstanceId: () => {
    if (get().droppedLegos.length === 0) {
      return "1";
    }
    return String(
      Math.max(...get().droppedLegos.map((lego) => parseInt(lego.instanceId))) +
        1
    );
  },

  setDroppedLegos: (
    legos: DroppedLego[] | ((prev: DroppedLego[]) => DroppedLego[])
  ) => {
    set((state: DroppedLegosSlice) => ({
      droppedLegos:
        typeof legos === "function" ? legos(state.droppedLegos) : legos
    }));
    get().updateEncodedCanvasState();
  },

  addDroppedLego: (lego: DroppedLego) => {
    set((state: DroppedLegosSlice) => ({
      droppedLegos: [...state.droppedLegos, lego]
    }));
    get().updateEncodedCanvasState();
  },

  addDroppedLegos: (legos: DroppedLego[]) => {
    set((state: DroppedLegosSlice) => ({
      droppedLegos: [...state.droppedLegos, ...legos]
    }));
    get().updateEncodedCanvasState();
  },

  removeDroppedLego: (instanceId: string) => {
    set((state: DroppedLegosSlice) => ({
      droppedLegos: state.droppedLegos.filter(
        (lego: DroppedLego) => lego.instanceId !== instanceId
      )
    }));
    get().updateEncodedCanvasState();
  },

  removeDroppedLegos: (instanceIds: string[]) => {
    set((state: DroppedLegosSlice) => ({
      droppedLegos: state.droppedLegos.filter(
        (lego: DroppedLego) => !instanceIds.includes(lego.instanceId)
      )
    }));
    get().updateEncodedCanvasState();
  },

  updateDroppedLego: (instanceId: string, updates: Partial<DroppedLego>) => {
    set((state: DroppedLegosSlice) => ({
      droppedLegos: state.droppedLegos.map((lego: DroppedLego) =>
        lego.instanceId === instanceId ? { ...lego, ...updates } : lego
      )
    }));
    get().updateEncodedCanvasState();
  },

  clearDroppedLegos: () => {
    set({ droppedLegos: [] });
    get().updateEncodedCanvasState();
  }
});
