import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego } from "./droppedLegoStore";
import { applyChangeColor } from "@/transformations/zx/ChangeColor";
import { applyPullOutSameColoredLeg } from "@/transformations/zx/PullOutSameColoredLeg";
import { applyBialgebra } from "@/transformations/zx/Bialgebra";
import { applyInverseBialgebra } from "@/transformations/zx/InverseBialgebra";
import { applyHopfRule } from "@/transformations/zx/Hopf";
import { applyConnectGraphNodes } from "@/transformations/graph-states/ConnectGraphNodesWithCenterLego";
import { applyCompleteGraphViaHadamards } from "@/transformations/graph-states/CompleteGraphViaHadamards";

export interface ZXTransformationsSlice {
  handlePullOutSameColoredLeg: (lego: DroppedLego) => void;
  handleChangeColor: (lego: DroppedLego) => void;
  handleBialgebra: (legos: DroppedLego[]) => void;
  handleInverseBialgebra: (legos: DroppedLego[]) => void;
  handleHopfRule: (legos: DroppedLego[]) => void;
  handleConnectGraphNodes: (legos: DroppedLego[]) => void;
  handleCompleteGraphViaHadamards: (legos: DroppedLego[]) => void;
  handleLegPartitionDialogClose: () => void;
  setShowLegPartitionDialog: (show: boolean) => void;
  showLegPartitionDialog: boolean;
}

export const createZXTransformationsSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  ZXTransformationsSlice
> = (set, get) => ({
  showLegPartitionDialog: false,
  setShowLegPartitionDialog: (show) =>
    set((state) => {
      state.showLegPartitionDialog = show;
    }),

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

  handleConnectGraphNodes: (legos: DroppedLego[]) => {
    const { droppedLegos, connections, setLegosAndConnections, addOperation } =
      get();
    const result = applyConnectGraphNodes(legos, droppedLegos, connections);
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
  },

  handleCompleteGraphViaHadamards: (legos: DroppedLego[]) => {
    const { droppedLegos, connections, setLegosAndConnections, addOperation } =
      get();
    const result = applyCompleteGraphViaHadamards(
      legos,
      droppedLegos,
      connections
    );
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
    get().setShowLegPartitionDialog(false);
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
  }
});
