import { StateCreator } from "zustand";
import { WritableDraft } from "immer";
import { getLegoStyle, LegoStyle } from "../LegoStyles";
import { CanvasStore } from "./canvasStateStore";

export function recalculateLegoStyle(lego: DroppedLego): void {
  lego.style = getLegoStyle(
    lego.id,
    lego.parity_check_matrix[0].length / 2,
    lego
  );
}

export function createHadamardLego(
  x: number,
  y: number,
  instanceId: string
): DroppedLego {
  return new DroppedLego(
    {
      id: "h",
      name: "Hadamard",
      shortName: "H",
      description: "Hadamard",
      parity_check_matrix: [
        [1, 0, 0, 1],
        [0, 1, 1, 0]
      ],
      logical_legs: [],
      gauge_legs: []
    },
    x,
    y,
    instanceId
  );
}

export interface LegoPiece {
  id: string;
  name: string;
  shortName: string;
  description: string;
  is_dynamic?: boolean;
  parameters?: Record<string, unknown>;
  parity_check_matrix: number[][];
  logical_legs: number[];
  gauge_legs: number[];
}

export class DroppedLego implements LegoPiece {
  public id: string;
  public name: string;
  public shortName: string;
  public description: string;
  public parity_check_matrix: number[][];
  public logical_legs: number[];
  public gauge_legs: number[];
  public is_dynamic?: boolean;
  public parameters?: Record<string, unknown>;
  public x: number;
  public y: number;
  public instanceId: string;
  private _selectedMatrixRows: number[];
  public alwaysShowLegs: boolean;
  public style: LegoStyle;

  constructor(
    lego: LegoPiece,
    // mandatory parameters
    x: number,
    y: number,
    instanceId: string,
    // optional overrides
    overrides: Partial<DroppedLego> = {}
  ) {
    this.id = lego.id;
    this.name = lego.name;
    this.shortName = lego.shortName;
    this.description = lego.description;
    this.parity_check_matrix = lego.parity_check_matrix;
    this.logical_legs = lego.logical_legs;
    this.gauge_legs = lego.gauge_legs;
    this.is_dynamic = lego.is_dynamic;
    this.parameters = lego.parameters;
    this.x = x;
    this.y = y;
    this.instanceId = instanceId;
    this._selectedMatrixRows = overrides.selectedMatrixRows || [];
    this.alwaysShowLegs = overrides.alwaysShowLegs || false;

    this.style = getLegoStyle(
      lego.id,
      lego.parity_check_matrix[0].length / 2,
      this
    );
  }

  public with(overrides: Partial<DroppedLego>): DroppedLego {
    return new DroppedLego(
      this,
      overrides.x || this.x,
      overrides.y || this.y,
      overrides.instanceId || this.instanceId,
      {
        selectedMatrixRows:
          overrides.selectedMatrixRows || this.selectedMatrixRows,
        ...overrides
      }
    );
  }

  public get selectedMatrixRows(): number[] {
    return this._selectedMatrixRows;
  }
}

export interface DroppedLegosSlice {
  droppedLegos: DroppedLego[];

  setDroppedLegos: (legos: DroppedLego[]) => void;
  addDroppedLego: (lego: DroppedLego) => void;
  addDroppedLegos: (legos: DroppedLego[]) => void;
  removeDroppedLego: (instanceId: string) => void;
  updateDroppedLego: (instanceId: string, updates: DroppedLego) => void;
  updateDroppedLegos: (legos: DroppedLego[]) => void;
  removeDroppedLegos: (instanceIds: string[]) => void;
  clearDroppedLegos: () => void;
  newInstanceId: () => string;
}

// The non-store version of the newInstanceId logic, it simply returns max instance id + 1
export function newInstanceId(droppedLegos: DroppedLego[]): string {
  if (droppedLegos.length === 0) {
    return "1";
  }
  return String(
    Math.max(...droppedLegos.map((lego) => parseInt(lego.instanceId))) + 1
  );
}

export const createLegoSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  DroppedLegosSlice
> = (set, get) => ({
  droppedLegos: [],
  newInstanceId: () => {
    return newInstanceId(get().droppedLegos);
  },

  setDroppedLegos: (legos: DroppedLego[]) => {
    console.log("setDroppedLegos", legos, new Error("debug").stack);
    set((state) => {
      state.droppedLegos = legos;
    });
    get().updateEncodedCanvasState();
  },

  addDroppedLego: (lego: DroppedLego) => {
    set((state) => {
      state.droppedLegos.push(lego);
    });
    get().updateEncodedCanvasState();
  },

  addDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      state.droppedLegos.push(...legos);
    });
    get().updateEncodedCanvasState();
  },

  removeDroppedLego: (instanceId: string) => {
    set((state) => {
      state.droppedLegos = state.droppedLegos.filter(
        (lego) => lego.instanceId !== instanceId
      );
    });
    get().updateEncodedCanvasState();
  },

  removeDroppedLegos: (instanceIds: string[]) => {
    set((state) => {
      state.droppedLegos = state.droppedLegos.filter(
        (lego) => !instanceIds.includes(lego.instanceId)
      );
    });
    get().updateEncodedCanvasState();
  },

  updateDroppedLego: (instanceId: string, updates: DroppedLego) => {
    set((state) => {
      const legoIndex = state.droppedLegos.findIndex(
        (l) => l.instanceId === instanceId
      );
      if (legoIndex !== -1) {
        state.droppedLegos[legoIndex] = updates;
      }
    });
    get().updateEncodedCanvasState();
  },

  updateDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      // Create a Map for quick lookups of existing legos by instanceId
      const existingLegosMap = new Map<string, WritableDraft<DroppedLego>>();
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
    });
    get().updateEncodedCanvasState();
  },

  clearDroppedLegos: () => {
    set((state) => {
      state.droppedLegos = [];
    });
    get().updateEncodedCanvasState();
  }
});
