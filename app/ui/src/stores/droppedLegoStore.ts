import { StateCreator } from "zustand";
import { getLegoStyle, LegoStyle } from "../features/lego/LegoStyles";
import { CanvasStore } from "./canvasStateStore";

export function recalculateLegoStyle(lego: DroppedLego): void {
  lego.style = getLegoStyle(lego.id, lego.numberOfLegs, lego);
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

    this.style = getLegoStyle(lego.id, this.numberOfLegs, this);
  }

  public get numberOfLegs(): number {
    return this.parity_check_matrix[0].length / 2;
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
        alwaysShowLegs: overrides.alwaysShowLegs ?? this.alwaysShowLegs,
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
  connectedLegos: DroppedLego[];

  temporarilyConnectLego: (instanceId: string) => void;
  updateLegoConnectivity: (instanceId: string) => void;

  setDroppedLegos: (legos: DroppedLego[]) => void;
  addDroppedLego: (lego: DroppedLego) => void;
  addDroppedLegos: (legos: DroppedLego[]) => void;
  removeDroppedLego: (instanceId: string) => void;
  updateDroppedLego: (instanceId: string, updates: DroppedLego) => void;
  updateDroppedLegos: (legos: DroppedLego[]) => void;
  moveDroppedLegos: (legos: DroppedLego[]) => void;
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
  connectedLegos: [],
  newInstanceId: () => {
    return newInstanceId(get().droppedLegos);
  },

  temporarilyConnectLego: (instanceId: string) => {
    set((state) => {
      if (
        !state.connectedLegos.find((lego) => lego.instanceId === instanceId)
      ) {
        state.connectedLegos.push(
          state.droppedLegos.find((lego) => lego.instanceId === instanceId)!
        );
      }
    });
  },

  updateLegoConnectivity: (instanceId: string) => {
    set((state) => {
      if (
        !get().connections.some(
          (connection) =>
            connection.from.legoId === instanceId ||
            connection.to.legoId === instanceId
        )
      ) {
        state.connectedLegos = state.connectedLegos.filter(
          (lego) => lego.instanceId !== instanceId
        );
      }
    });
  },
  setDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      state.droppedLegos = legos;
      state.connectedLegos = legos.filter((lego) =>
        get().connections.some(
          (connection) =>
            connection.from.legoId === lego.instanceId ||
            connection.to.legoId === lego.instanceId
        )
      );
    });
    get().updateAllConnectionHighlightStates();
    get().updateAllLegHideStates();
    get().updateLegoConnectionMap();
    get().updateEncodedCanvasState();
  },

  addDroppedLego: (lego: DroppedLego) => {
    set((state) => {
      state.droppedLegos.push(lego);
    });
    // Initialize leg hide states for the new lego
    get().initializeLegHideStates(lego.instanceId, lego.numberOfLegs);
    // Initialize leg connection states for the new lego
    get().initializeLegConnectionStates(lego.instanceId, lego.numberOfLegs);
    // Update all leg hide states to account for the new lego
    get().updateAllLegHideStates();
    get().updateEncodedCanvasState();
  },

  addDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      state.droppedLegos.push(...legos);
    });
    // Initialize leg hide states for new legos
    legos.forEach((lego) => {
      get().initializeLegHideStates(lego.instanceId, lego.numberOfLegs);
      get().initializeLegConnectionStates(lego.instanceId, lego.numberOfLegs);
    });
    // Update all leg hide states to account for the new legos
    get().updateAllLegHideStates();
    get().updateEncodedCanvasState();
  },

  removeDroppedLego: (instanceId: string) => {
    set((state) => {
      state.droppedLegos = state.droppedLegos.filter(
        (lego) => lego.instanceId !== instanceId
      );
      if (state.connectedLegos.some((lego) => lego.instanceId === instanceId)) {
        state.connectedLegos = state.connectedLegos.filter(
          (lego) => lego.instanceId !== instanceId
        );
      }
    });
    // Remove leg hide states for the deleted lego
    get().removeLegHideStates(instanceId);
    // Remove leg connection states for the deleted lego
    get().removeLegConnectionStates(instanceId);
    // Remove lego from connection map
    get().removeLegoFromConnectionMap(instanceId);
    // Update all leg hide states to account for the removed lego
    get().updateAllLegHideStates();
    get().updateEncodedCanvasState();
  },

  removeDroppedLegos: (instanceIds: string[]) => {
    set((state) => {
      state.droppedLegos = state.droppedLegos.filter(
        (lego) => !instanceIds.includes(lego.instanceId)
      );
      if (
        state.connectedLegos.some((lego) =>
          instanceIds.includes(lego.instanceId)
        )
      ) {
        state.connectedLegos = state.connectedLegos.filter(
          (lego) => !instanceIds.includes(lego.instanceId)
        );
      }
    });
    // Remove leg hide states for deleted legos
    instanceIds.forEach((instanceId) => {
      get().removeLegHideStates(instanceId);
      get().removeLegConnectionStates(instanceId);
      get().removeLegoFromConnectionMap(instanceId);
    });
    // Update all leg hide states to account for the removed legos
    get().updateAllLegHideStates();
    get().setTensorNetwork(null);
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
      const connectedLegoIndex = state.connectedLegos.findIndex(
        (l) => l.instanceId === instanceId
      );
      if (connectedLegoIndex !== -1) {
        state.connectedLegos[connectedLegoIndex] = updates;
      }
    });
    // Update leg hide states if the number of legs changed
    const existingStates = get().getLegHideStates(instanceId);
    if (existingStates.length !== updates.numberOfLegs) {
      get().initializeLegHideStates(instanceId, updates.numberOfLegs);
      get().initializeLegConnectionStates(instanceId, updates.numberOfLegs);
    }
    // Update all leg hide states to account for the updated lego
    get().updateAllLegHideStates();
    get().updateEncodedCanvasState();
  },

  moveDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      // Create a Map of the updates for quick lookup
      const updatesMap = new Map(legos.map((lego) => [lego.instanceId, lego]));

      // Iterate over the existing legos and replace them if an update exists
      state.droppedLegos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instanceId);
        if (updatedLego) {
          state.droppedLegos[index] = updatedLego;
        }
      });

      state.connectedLegos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instanceId);
        if (updatedLego) {
          state.connectedLegos[index] = updatedLego;
        }
      });
    });
    get().updateEncodedCanvasState();
  },
  updateDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      // Create a Map of the updates for quick lookup
      const updatesMap = new Map(legos.map((lego) => [lego.instanceId, lego]));

      // Iterate over the existing legos and replace them if an update exists
      state.droppedLegos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instanceId);
        if (updatedLego) {
          state.droppedLegos[index] = updatedLego;
        }
      });

      state.connectedLegos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instanceId);
        if (updatedLego) {
          state.connectedLegos[index] = updatedLego;
        }
      });
    });
    // Update leg hide states for updated legos
    legos.forEach((lego) => {
      const existingStates = get().getLegHideStates(lego.instanceId);
      if (existingStates.length !== lego.numberOfLegs) {
        get().initializeLegHideStates(lego.instanceId, lego.numberOfLegs);
        get().initializeLegConnectionStates(lego.instanceId, lego.numberOfLegs);
      }
    });
    // Update all leg hide states to account for the updated legos
    get().updateAllLegHideStates();
    get().updateEncodedCanvasState();
  },

  clearDroppedLegos: () => {
    set((state) => {
      state.droppedLegos = [];
      state.connectedLegos = [];
    });
    // Clear all leg hide states
    get().clearAllLegHideStates();
    // Clear all leg connection states
    get().clearAllLegConnectionStates();
    // Clear all connection highlight states
    get().clearAllConnectionHighlightStates();
    // Clear all lego connection mappings
    get().clearLegoConnectionMap();
    get().updateEncodedCanvasState();
  }
});
