import { StateCreator } from "zustand";
import {
  GenericStyle,
  HadamardStyle,
  IdentityStyle,
  LegoStyle,
  RepetitionCodeStyle,
  ScalarStyle,
  StopperStyle,
  X_REP_CODE,
  Z_REP_CODE
} from "../features/lego/LegoStyles";
import { CanvasStore } from "./canvasStateStore";
import { LogicalPoint } from "../types/coordinates";
import { Legos } from "../features/lego/Legos";
import { PauliOperator } from "../lib/types";
import { SvgLegoStyle } from "../features/lego/SvgLegoStyle";

export function getLegoStyle(
  type_id: string,
  numLegs: number,
  lego: DroppedLego
): LegoStyle {
  // Check if this lego type has a custom SVG
  if (SvgLegoStyle.supportedLegoTypes.includes(type_id)) {
    return new SvgLegoStyle(type_id, lego);
  }

  if (numLegs === 0) {
    return new ScalarStyle(type_id, lego);
  } else if (type_id === "h") {
    return new HadamardStyle(type_id, lego);
  } else if (type_id === Z_REP_CODE || type_id === X_REP_CODE) {
    if (numLegs > 2) {
      return new RepetitionCodeStyle(type_id, lego);
    } else if (numLegs === 2) {
      return new IdentityStyle(type_id, lego);
    } else if (numLegs === 1) {
      return new StopperStyle(
        type_id === Z_REP_CODE ? "stopper_z" : "stopper_x",
        lego
      );
    } else {
      return new GenericStyle(type_id, lego);
    }
  } else if (type_id.includes("stopper")) {
    return new StopperStyle(type_id, lego);
  } else if (type_id === "identity") {
    return new IdentityStyle(type_id, lego);
  } else {
    return new GenericStyle(type_id, lego);
  }
}

export function recalculateLegoStyle(lego: DroppedLego): void {
  lego.style = getLegoStyle(lego.type_id, lego.numberOfLegs, lego);
}

export function createXRepCodeLego(
  canvasPosition: LogicalPoint,
  instance_id: string,
  d: number = 3
): DroppedLego {
  return new DroppedLego(
    {
      type_id: "x_rep_code",
      name: "X Repetition Code",
      short_name: "XRep",
      description: "X Repetition Code",
      parity_check_matrix: Legos.x_rep_code(d),
      logical_legs: [],
      gauge_legs: []
    },
    canvasPosition,
    instance_id
  );
}

export function createZRepCodeLego(
  canvasPosition: LogicalPoint,
  instance_id: string,
  d: number = 3
): DroppedLego {
  return new DroppedLego(
    {
      type_id: "z_rep_code",
      name: "Z Repetition Code",
      short_name: "ZRep",
      description: "Z Repetition Code",
      parity_check_matrix: Legos.z_rep_code(d),
      logical_legs: [],
      gauge_legs: []
    },
    canvasPosition,
    instance_id
  );
}

export function createHadamardLego(
  canvasPosition: LogicalPoint,
  instance_id: string
): DroppedLego {
  return new DroppedLego(
    {
      type_id: "h",
      name: "Hadamard",
      short_name: "H",
      description: "Hadamard",
      parity_check_matrix: [
        [1, 0, 0, 1],
        [0, 1, 1, 0]
      ],
      logical_legs: [],
      gauge_legs: []
    },
    canvasPosition,
    instance_id
  );
}

export interface LegoPiece {
  type_id: string;
  name: string;
  short_name: string;
  description: string;
  is_dynamic?: boolean;
  parameters?: Record<string, unknown>;
  parity_check_matrix: number[][];
  logical_legs: number[];
  gauge_legs: number[];
}

export class DroppedLego implements LegoPiece {
  public type_id: string;
  public name: string;
  public short_name: string;
  public description: string;
  public parity_check_matrix: number[][];
  public logical_legs: number[];
  public gauge_legs: number[];
  public is_dynamic?: boolean;
  public parameters?: Record<string, unknown>;
  public instance_id: string;
  private _selectedMatrixRows: number[];
  public alwaysShowLegs: boolean;
  public style: LegoStyle;
  public logicalPosition: LogicalPoint;
  public highlightedLegConstraints: {
    legIndex: number;
    operator: PauliOperator;
  }[];

  constructor(
    lego: LegoPiece,
    // mandatory parameters
    canvasPosition: LogicalPoint,
    instance_id: string,
    // optional overrides
    overrides: Partial<DroppedLego> = {}
  ) {
    this.type_id = lego.type_id;
    this.name = lego.name;
    this.short_name = overrides.short_name || lego.short_name;
    this.description = overrides.description || lego.description;
    this.parity_check_matrix =
      overrides.parity_check_matrix || lego.parity_check_matrix;
    this.logical_legs = lego.logical_legs;
    this.gauge_legs = lego.gauge_legs;
    this.is_dynamic = lego.is_dynamic;
    this.parameters = lego.parameters;
    this.logicalPosition = canvasPosition;
    this.instance_id = instance_id;
    this._selectedMatrixRows = overrides.selectedMatrixRows || [];
    this.alwaysShowLegs = overrides.alwaysShowLegs || false;
    this.highlightedLegConstraints = overrides.highlightedLegConstraints || [];
    this.style =
      overrides.style || getLegoStyle(lego.type_id, this.numberOfLegs, this);
  }

  public get numberOfLegs(): number {
    return Math.trunc(this.parity_check_matrix[0].length / 2);
  }

  public with(overrides: Partial<DroppedLego>): DroppedLego {
    return new DroppedLego(
      this,
      overrides.logicalPosition || this.logicalPosition,
      overrides.instance_id || this.instance_id,
      {
        selectedMatrixRows:
          overrides.selectedMatrixRows || this.selectedMatrixRows,
        alwaysShowLegs: overrides.alwaysShowLegs ?? this.alwaysShowLegs,
        highlightedLegConstraints:
          overrides.highlightedLegConstraints || this.highlightedLegConstraints,
        ...overrides
      }
    );
  }

  public get selectedMatrixRows(): number[] {
    return this._selectedMatrixRows;
  }

  public get scalarValue(): number | null {
    if (this.numberOfLegs === 0) {
      return this.parity_check_matrix[0][0];
    }
    return null;
  }

  public clone(): DroppedLego {
    return new DroppedLego(this, this.logicalPosition, this.instance_id, {
      style: this.style
    });
  }

  public get isSvgLego(): boolean {
    return this.style instanceof SvgLegoStyle;
  }
}

export interface DroppedLegosSlice {
  droppedLegos: DroppedLego[];
  connectedLegos: DroppedLego[];

  temporarilyConnectLego: (instance_id: string) => void;
  updateLegoConnectivity: (instance_id: string) => void;

  setDroppedLegos: (legos: DroppedLego[]) => void;
  addDroppedLego: (lego: DroppedLego) => void;
  addDroppedLegos: (legos: DroppedLego[]) => void;
  removeDroppedLego: (instance_id: string) => void;
  updateDroppedLego: (instance_id: string, updates: DroppedLego) => void;
  updateDroppedLegos: (legos: DroppedLego[]) => void;
  updateConnectedLegos: () => void;
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
    Math.max(...droppedLegos.map((lego) => parseInt(lego.instance_id))) + 1
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

  temporarilyConnectLego: (instance_id: string) => {
    set((state) => {
      if (
        !state.connectedLegos.find((lego) => lego.instance_id === instance_id)
      ) {
        state.connectedLegos.push(
          state.droppedLegos.find((lego) => lego.instance_id === instance_id)!
        );
      }
    });
  },

  updateLegoConnectivity: (instance_id: string) => {
    set((state) => {
      if (
        !get().connections.some(
          (connection) =>
            connection.from.legoId === instance_id ||
            connection.to.legoId === instance_id
        )
      ) {
        state.connectedLegos = state.connectedLegos.filter(
          (lego) => lego.instance_id !== instance_id
        );
      }
    });
  },
  setDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      state.droppedLegos = legos;
    });
    get().updateConnectedLegos();
    get().updateAllConnectionHighlightStates();
    get().updateAllLegHideStates();
    get().updateLegoConnectionMap();
  },

  updateConnectedLegos: () => {
    set((state) => {
      state.connectedLegos = state.droppedLegos.filter((lego) =>
        get().connections.some(
          (connection) =>
            connection.from.legoId === lego.instance_id ||
            connection.to.legoId === lego.instance_id
        )
      );
    });
  },

  addDroppedLego: (lego: DroppedLego) => {
    set((state) => {
      state.droppedLegos.push(lego);
    });
    // Initialize leg hide states for the new lego
    get().initializeLegHideStates(lego.instance_id, lego.numberOfLegs);
    // Initialize leg connection states for the new lego
    get().initializeLegConnectionStates(lego.instance_id, lego.numberOfLegs);
    // Update all leg hide states to account for the new lego
    get().updateAllLegHideStates();
  },

  addDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      state.droppedLegos.push(...legos);
    });
    // Initialize leg hide states for new legos
    legos.forEach((lego) => {
      get().initializeLegHideStates(lego.instance_id, lego.numberOfLegs);
      get().initializeLegConnectionStates(lego.instance_id, lego.numberOfLegs);
    });
    // Update all leg hide states to account for the new legos
    get().updateAllLegHideStates();
  },

  removeDroppedLego: (instance_id: string) => {
    const removedConnections = get().connections.filter((connection) =>
      connection.containsLego(instance_id)
    );
    set((state) => {
      state.droppedLegos = state.droppedLegos.filter(
        (lego) => lego.instance_id !== instance_id
      );
      if (
        state.connectedLegos.some((lego) => lego.instance_id === instance_id)
      ) {
        state.connectedLegos = state.connectedLegos.filter(
          (lego) => lego.instance_id !== instance_id
        );
      }
    });
    // Remove leg hide states for the deleted lego
    get().removeLegHideStates(instance_id);
    // Remove leg connection states for the deleted lego
    get().removeLegConnectionStates(instance_id);
    // Remove lego from connection map
    get().removeLegoFromConnectionMap(instance_id);
    // Update all leg hide states to account for the removed lego
    get().updateAllLegHideStates();
    get().updateCachedTensorNetworks([instance_id], removedConnections);
  },

  removeDroppedLegos: (instanceIds: string[]) => {
    const removedConnections = get().connections.filter((connection) =>
      instanceIds.some((instance_id) => connection.containsLego(instance_id))
    );
    set((state) => {
      state.droppedLegos = state.droppedLegos.filter(
        (lego) => !instanceIds.includes(lego.instance_id)
      );
      if (
        state.connectedLegos.some((lego) =>
          instanceIds.includes(lego.instance_id)
        )
      ) {
        state.connectedLegos = state.connectedLegos.filter(
          (lego) => !instanceIds.includes(lego.instance_id)
        );
      }
    });
    // Remove leg hide states for deleted legos
    instanceIds.forEach((instance_id) => {
      get().removeLegHideStates(instance_id);
      get().removeLegConnectionStates(instance_id);
      get().removeLegoFromConnectionMap(instance_id);
    });
    get().updateCachedTensorNetworks(instanceIds, removedConnections);
    // Update all leg hide states to account for the removed legos
    get().updateAllLegHideStates();
    get().setTensorNetwork(null);
  },

  updateDroppedLego: (instance_id: string, updates: DroppedLego) => {
    set((state) => {
      const legoIndex = state.droppedLegos.findIndex(
        (l) => l.instance_id === instance_id
      );
      if (legoIndex !== -1) {
        state.droppedLegos[legoIndex] = updates;
      }
      const connectedLegoIndex = state.connectedLegos.findIndex(
        (l) => l.instance_id === instance_id
      );
      if (connectedLegoIndex !== -1) {
        state.connectedLegos[connectedLegoIndex] = updates;
      }
      state.tensorNetwork?.legos.forEach((lego, index) => {
        if (lego.instance_id === instance_id) {
          state.tensorNetwork!.legos[index] = updates;
        }
      });
    });
    // Update leg hide states if the number of legs changed
    const existingStates = get().getLegHideStates(instance_id);
    if (existingStates.length !== updates.numberOfLegs) {
      get().initializeLegHideStates(instance_id, updates.numberOfLegs);
      get().initializeLegConnectionStates(instance_id, updates.numberOfLegs);
    }
    // Update all leg hide states to account for the updated lego
    get().updateAllLegHideStates();
    get().updateCachedTensorNetworks([instance_id], []);
  },

  moveDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      // Create a Map of the updates for quick lookup
      const updatesMap = new Map(legos.map((lego) => [lego.instance_id, lego]));

      // Iterate over the existing legos and replace them if an update exists
      state.droppedLegos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instance_id);
        if (updatedLego) {
          state.droppedLegos[index] = updatedLego;
        }
      });

      state.connectedLegos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instance_id);
        if (updatedLego) {
          state.connectedLegos[index] = updatedLego;
        }
      });
      state.tensorNetwork?.legos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instance_id);
        if (updatedLego) {
          state.tensorNetwork!.legos[index] = updatedLego;
        }
      });
    });
    get().updateAllLegHideStates();
  },
  updateDroppedLegos: (legos: DroppedLego[]) => {
    set((state) => {
      // Create a Map of the updates for quick lookup
      const updatesMap = new Map(legos.map((lego) => [lego.instance_id, lego]));

      // Iterate over the existing legos and replace them if an update exists
      state.droppedLegos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instance_id);
        if (updatedLego) {
          state.droppedLegos[index] = updatedLego;
        }
      });

      state.connectedLegos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instance_id);
        if (updatedLego) {
          state.connectedLegos[index] = updatedLego;
        }
      });
      state.tensorNetwork?.legos.forEach((lego, index) => {
        const updatedLego = updatesMap.get(lego.instance_id);
        if (updatedLego) {
          state.tensorNetwork!.legos[index] = updatedLego;
        }
      });
    });
    // Update leg hide states for updated legos
    legos.forEach((lego) => {
      const existingStates = get().getLegHideStates(lego.instance_id);
      if (existingStates.length !== lego.numberOfLegs) {
        get().initializeLegHideStates(lego.instance_id, lego.numberOfLegs);
        get().initializeLegConnectionStates(
          lego.instance_id,
          lego.numberOfLegs
        );
      }
    });

    // Update all leg hide states to account for the updated legos
    get().updateAllLegHideStates();
  },

  clearDroppedLegos: () => {
    const removedConnections = get().connections;
    const removedLegoInstanceIds = get().droppedLegos.map(
      (lego) => lego.instance_id
    );
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
    get().updateCachedTensorNetworks(
      removedLegoInstanceIds,
      removedConnections
    );
  }
});
