import { StateCreator } from "zustand";
import { DroppedLego } from "../lib/types";

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
  DroppedLegosSlice,
  [],
  [],
  DroppedLegosSlice
> = (set, get) => ({
  droppedLegos: [],
  newInstanceId: () => {
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
  },

  addDroppedLego: (lego: DroppedLego) =>
    set((state: DroppedLegosSlice) => ({
      droppedLegos: [...state.droppedLegos, lego]
    })),

  addDroppedLegos: (legos: DroppedLego[]) =>
    set((state: DroppedLegosSlice) => ({
      droppedLegos: [...state.droppedLegos, ...legos]
    })),

  removeDroppedLego: (instanceId: string) =>
    set((state: DroppedLegosSlice) => ({
      droppedLegos: state.droppedLegos.filter(
        (lego: DroppedLego) => lego.instanceId !== instanceId
      )
    })),

  removeDroppedLegos: (instanceIds: string[]) =>
    set((state: DroppedLegosSlice) => ({
      droppedLegos: state.droppedLegos.filter(
        (lego: DroppedLego) => !instanceIds.includes(lego.instanceId)
      )
    })),

  updateDroppedLego: (instanceId: string, updates: Partial<DroppedLego>) =>
    set((state: DroppedLegosSlice) => ({
      droppedLegos: state.droppedLegos.map((lego: DroppedLego) =>
        lego.instanceId === instanceId ? { ...lego, ...updates } : lego
      )
    })),

  clearDroppedLegos: () => set({ droppedLegos: [] })
});
