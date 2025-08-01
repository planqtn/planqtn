import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego } from "./droppedLegoStore";
import { applyChangeColor } from "@/transformations/zx/ChangeColor";
import { applyPullOutSameColoredLeg } from "@/transformations/zx/PullOutSameColoredLeg";
import { applyBialgebra } from "@/transformations/zx/Bialgebra";
import { applyInverseBialgebra } from "@/transformations/zx/InverseBialgebra";
import { applyHopfRule } from "@/transformations/zx/Hopf";
import { applyUnfuseInto2Legos } from "@/transformations/zx/UnfuseIntoTwoLegos";
import { applyUnfuseToLegs } from "@/transformations/zx/UnfuseToLegs";

export interface ZXTransformationsSlice {
  handlePullOutSameColoredLeg: (lego: DroppedLego) => void;
  handleChangeColor: (lego: DroppedLego) => void;
  handleBialgebra: (legos: DroppedLego[]) => void;
  handleInverseBialgebra: (legos: DroppedLego[]) => void;
  handleHopfRule: (legos: DroppedLego[]) => void;

  handleLegPartitionDialogClose: () => void;
  handleUnfuseInto2Legos: (lego: DroppedLego) => void;
  handleUnfuseTo2LegosPartitionConfirm: (legPartition: number[]) => void;
  handleUnfuseToLegs: (lego: DroppedLego) => void;
  unfuseLego: DroppedLego | null;
  setUnfuseLego: (lego: DroppedLego | null) => void;
}

export const createZXTransformationsSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  ZXTransformationsSlice
> = (set, get) => ({
  unfuseLego: null,
  setUnfuseLego: (lego) => set({ unfuseLego: lego }),

  handleChangeColor: (lego: DroppedLego) => {
    const { droppedLegos, connections, setLegosAndConnections, addOperation } =
      get();
    const {
      connections: newConnections,
      droppedLegos: newDroppedLegos,
      operation
    } = applyChangeColor(lego, droppedLegos, connections);
    setLegosAndConnections(newDroppedLegos, newConnections);
    addOperation(operation);
  },

  handlePullOutSameColoredLeg: (lego) => {
    const {
      droppedLegos,
      connections,
      setLegosAndConnections,
      addOperation,
      setError
    } = get();

    try {
      const {
        connections: newConnections,
        droppedLegos: newDroppedLegos,
        operation
      } = applyPullOutSameColoredLeg(lego, droppedLegos, connections);

      setLegosAndConnections(newDroppedLegos, newConnections);

      // Add to operation history
      addOperation(operation);
    } catch (error) {
      if (setError)
        setError(
          `Error pulling out opposite leg: ${error instanceof Error ? error.message : String(error)}`
        );
    }
  },

  handleHopfRule: (legos: DroppedLego[]) => {
    const { droppedLegos, connections, setLegosAndConnections, addOperation } =
      get();
    const result = applyHopfRule(legos, droppedLegos, connections);
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
  },

  handleLegPartitionDialogClose: () => {
    // Call cleanup to restore original state
    const windowWithRestore = window as Window & {
      __restoreLegsState?: () => void;
    };
    windowWithRestore.__restoreLegsState?.();
    delete windowWithRestore.__restoreLegsState;
    get().closeLegPartitionDialog();
  },

  handleBialgebra: (legos: DroppedLego[]) => {
    const { droppedLegos, connections, setLegosAndConnections, addOperation } =
      get();
    const result = applyBialgebra(legos, droppedLegos, connections);
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
  },

  handleInverseBialgebra: (legos: DroppedLego[]) => {
    const { droppedLegos, connections, setLegosAndConnections, addOperation } =
      get();
    const result = applyInverseBialgebra(legos, droppedLegos, connections);
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
  },

  handleUnfuseInto2Legos: (lego: DroppedLego) => {
    // Store the original state
    const originalAlwaysShowLegs = lego.alwaysShowLegs;

    // Temporarily force legs to be shown
    const updatedLego = lego.with({ alwaysShowLegs: true });
    get().setDroppedLegos(
      get().droppedLegos.map((l) =>
        l.instance_id === lego.instance_id ? updatedLego : l
      )
    );
    get().setUnfuseLego(updatedLego);
    get().openLegPartitionDialog();

    // Add cleanup function to restore original state when dialog closes
    const cleanup = () => {
      get().setDroppedLegos(
        get().droppedLegos.map((l) =>
          l.instance_id === lego.instance_id
            ? l.with({ alwaysShowLegs: originalAlwaysShowLegs })
            : l
        )
      );
    };

    // Store cleanup function
    (
      window as Window & { __restoreLegsState?: () => void }
    ).__restoreLegsState = cleanup;
  },

  handleUnfuseTo2LegosPartitionConfirm: (legPartition: number[]) => {
    const lego = get().unfuseLego;
    if (!lego) {
      return;
    }

    try {
      const {
        droppedLegos,
        connections,
        setLegosAndConnections,
        addOperation
      } = get();

      const {
        connections: newConnections,
        droppedLegos: newDroppedLegos,
        operation
      } = applyUnfuseInto2Legos(lego, legPartition, droppedLegos, connections);

      setLegosAndConnections(newDroppedLegos, newConnections);
      addOperation(operation);
    } catch (error) {
      get().setError(
        `Error unfusing lego: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    get().closeLegPartitionDialog();
    get().setUnfuseLego(null);
  },

  handleUnfuseToLegs: (lego: DroppedLego) => {
    const { droppedLegos, connections, setLegosAndConnections, addOperation } =
      get();

    const {
      connections: newConnections,
      droppedLegos: newDroppedLegos,
      operation
    } = applyUnfuseToLegs(lego, droppedLegos, connections);

    setLegosAndConnections(newDroppedLegos, newConnections);
    addOperation(operation);
  }
});
