import { StateCreator } from "zustand";
import { produce } from "immer";
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
  updateDroppedLegos: (legos: DroppedLego[]) => void;
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
    set(
      produce((state: DroppedLegosSlice) => {
        state.droppedLegos =
          typeof legos === "function" ? legos(state.droppedLegos) : legos;
      })
    );
    get().updateEncodedCanvasState();
  },

  addDroppedLego: (lego: DroppedLego) => {
    set(
      produce((state: DroppedLegosSlice) => {
        state.droppedLegos.push(lego);
      })
    );
    get().updateEncodedCanvasState();
  },

  addDroppedLegos: (legos: DroppedLego[]) => {
    set(
      produce((state: DroppedLegosSlice) => {
        state.droppedLegos.push(...legos);
      })
    );
    get().updateEncodedCanvasState();
  },

  removeDroppedLego: (instanceId: string) => {
    set(
      produce((state: DroppedLegosSlice) => {
        state.droppedLegos = state.droppedLegos.filter(
          (lego: DroppedLego) => lego.instanceId !== instanceId
        );
      })
    );
    get().updateEncodedCanvasState();
  },

  removeDroppedLegos: (instanceIds: string[]) => {
    set(
      produce((state: DroppedLegosSlice) => {
        state.droppedLegos = state.droppedLegos.filter(
          (lego: DroppedLego) => !instanceIds.includes(lego.instanceId)
        );
      })
    );
    get().updateEncodedCanvasState();
  },

  updateDroppedLego: (instanceId: string, updates: Partial<DroppedLego>) => {
    set(
      produce((state: DroppedLegosSlice) => {
        const lego = state.droppedLegos.find(
          (l) => l.instanceId === instanceId
        );
        if (lego) Object.assign(lego, updates);
      })
    );
    get().updateEncodedCanvasState();
  },

  updateDroppedLegos: (legos: DroppedLego[]) => {
    set(
      produce((state: DroppedLegosSlice) => {
        // Create a Map for quick lookups of existing legos by instanceId
        const existingLegosMap = new Map<string, DroppedLego>();
        state.droppedLegos.forEach((lego) => {
          existingLegosMap.set(lego.instanceId, lego);
        });

        // Iterate over the updates and apply them
        for (const update of legos) {
          const lego = existingLegosMap.get(update.instanceId);
          if (lego) {
            Object.assign(lego, update);
          }
        }
      })
    );
    get().updateEncodedCanvasState();
  },

  clearDroppedLegos: () => {
    set(
      produce((state: DroppedLegosSlice) => {
        state.droppedLegos = [];
      })
    );
    get().updateEncodedCanvasState();
  }
});
