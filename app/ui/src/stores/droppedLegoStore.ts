import { StateCreator } from "zustand";
import { getLegoStyle, LegoStyle } from "../features/lego/LegoStyles";
import { CanvasStore } from "./canvasStateStore";
import { LogicalPoint } from "../types/coordinates";
import { Legos } from "../features/lego/Legos";

export function recalculateLegoStyle(lego: DroppedLego): void {
  lego.style = getLegoStyle(lego.typeId, lego.numberOfLegs, lego);
}

export function createXRepCodeLego(
  canvasPosition: LogicalPoint,
  instanceId: string,
  d: number = 3
): DroppedLego {
  return new DroppedLego(
    {
      typeId: "x_rep_code",
      name: "X Repetition Code",
      shortName: "XRep",
      description: "X Repetition Code",
      parityCheckMatrix: Legos.x_rep_code(d),
      logicalLegs: [],
      gaugeLegs: []
    },
    canvasPosition,
    instanceId
  );
}

export function createZRepCodeLego(
  canvasPosition: LogicalPoint,
  instanceId: string,
  d: number = 3
): DroppedLego {
  return new DroppedLego(
    {
      typeId: "z_rep_code",
      name: "Z Repetition Code",
      shortName: "ZRep",
      description: "Z Repetition Code",
      parityCheckMatrix: Legos.z_rep_code(d),
      logicalLegs: [],
      gaugeLegs: []
    },
    canvasPosition,
    instanceId
  );
}

export function createHadamardLego(
  canvasPosition: LogicalPoint,
  instanceId: string
): DroppedLego {
  return new DroppedLego(
    {
      typeId: "h",
      name: "Hadamard",
      shortName: "H",
      description: "Hadamard",
      parityCheckMatrix: [
        [1, 0, 0, 1],
        [0, 1, 1, 0]
      ],
      logicalLegs: [],
      gaugeLegs: []
    },
    canvasPosition,
    instanceId
  );
}

export interface LegoPiece {
  typeId: string;
  name: string;
  shortName: string;
  description: string;
  is_dynamic?: boolean;
  parameters?: Record<string, unknown>;
  parityCheckMatrix: number[][];
  logicalLegs: number[];
  gaugeLegs: number[];
}

export class DroppedLego implements LegoPiece {
  public typeId: string;
  public name: string;
  public shortName: string;
  public description: string;
  public parityCheckMatrix: number[][];
  public logicalLegs: number[];
  public gaugeLegs: number[];
  public is_dynamic?: boolean;
  public parameters?: Record<string, unknown>;
  public instanceId: string;
  private _selectedMatrixRows: number[];
  public alwaysShowLegs: boolean;
  public style: LegoStyle;
  public logicalPosition: LogicalPoint;

  constructor(
    lego: LegoPiece,
    // mandatory parameters
    canvasPosition: LogicalPoint,
    instanceId: string,
    // optional overrides
    overrides: Partial<DroppedLego> = {}
  ) {
    this.typeId = lego.typeId;
    this.name = lego.name;
    this.shortName = overrides.shortName || lego.shortName;
    this.description = overrides.description || lego.description;
    this.parityCheckMatrix =
      overrides.parityCheckMatrix || lego.parityCheckMatrix;
    this.logicalLegs = lego.logicalLegs;
    this.gaugeLegs = lego.gaugeLegs;
    this.is_dynamic = lego.is_dynamic;
    this.parameters = lego.parameters;
    this.logicalPosition = canvasPosition;
    this.instanceId = instanceId;
    this._selectedMatrixRows = overrides.selectedMatrixRows || [];
    this.alwaysShowLegs = overrides.alwaysShowLegs || false;

    this.style = getLegoStyle(lego.typeId, this.numberOfLegs, this);
  }

  public get numberOfLegs(): number {
    return Math.trunc(this.parityCheckMatrix[0].length / 2);
  }

  public with(overrides: Partial<DroppedLego>): DroppedLego {
    return new DroppedLego(
      this,
      overrides.logicalPosition || this.logicalPosition,
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

  public get scalarValue(): number | null {
    if (this.numberOfLegs === 0) {
      return this.parityCheckMatrix[0][0];
    }
    return null;
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
      state.tensorNetwork?.legos.forEach((lego, index) => {
        if (lego.instanceId === instanceId) {
          state.tensorNetwork!.legos[index] = updates;
        }
      });
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

      state.tensorNetwork?.legos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instanceId);
        if (updatedLego) {
          state.tensorNetwork!.legos[index] = updatedLego;
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
      state.tensorNetwork?.legos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instanceId);
        if (updatedLego) {
          state.tensorNetwork!.legos[index] = updatedLego;
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
