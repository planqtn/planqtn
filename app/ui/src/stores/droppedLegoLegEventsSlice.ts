import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { PauliOperator } from "../lib/types";
import { Connection } from "./connectionStore";
import { TensorNetwork } from "../lib/TensorNetwork";
import { simpleAutoFlow } from "../transformations/AutoPauliFlow";
import { WindowPoint } from "../types/coordinates";

export interface DroppedLegoLegEventsSlice {
  handleLegMouseDown: (
    legoId: string,
    leg_index: number,
    mouseWindowPoint: WindowPoint
  ) => void;

  handleLegClick: (legoId: string, leg_index: number) => void;
  handleLegMouseUp: (legoId: string, leg_index: number) => void;
}

export const useLegoLegEventsSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  DroppedLegoLegEventsSlice
> = (_, get) => ({
  handleLegMouseDown: (legoId, leg_index, mouseWindowPoint) => {
    get().temporarilyConnectLego(legoId);

    get().setLegDragState({
      isDragging: true,
      legoId,
      leg_index,
      startMouseWindowPoint: mouseWindowPoint,
      currentMouseWindowPoint: mouseWindowPoint
    });
  },

  handleLegClick: (legoId, leg_index) => {
    // Find the lego that was clicked
    const clickedLego = get().droppedLegos.find(
      (lego) => lego.instance_id === legoId
    );
    if (!clickedLego) return;
    const numQubits = clickedLego.numberOfLegs;
    const h = clickedLego.parity_check_matrix;
    const existingPushedLeg = clickedLego.selectedMatrixRows?.find(
      (row) => h[row][leg_index] == 1 || h[row][leg_index + numQubits] == 1
    );
    const currentOperator = existingPushedLeg
      ? h[existingPushedLeg][leg_index] == 1
        ? PauliOperator.X
        : PauliOperator.Z
      : PauliOperator.I;

    // Find available operators in parity check matrix for this leg
    const hasX = clickedLego.parity_check_matrix.some(
      (row) => row[leg_index] === 1 && row[leg_index + numQubits] === 0
    );
    const hasZ = clickedLego.parity_check_matrix.some(
      (row) => row[leg_index] === 0 && row[leg_index + numQubits] === 1
    );

    // Cycle through operators only if they exist in matrix
    let nextOperator: PauliOperator;
    switch (currentOperator) {
      case PauliOperator.I:
        nextOperator = hasX
          ? PauliOperator.X
          : hasZ
            ? PauliOperator.Z
            : PauliOperator.I;
        break;
      case PauliOperator.X:
        nextOperator = hasZ ? PauliOperator.Z : PauliOperator.I;
        break;
      case PauliOperator.Z:
        nextOperator = PauliOperator.I;
        break;
      default:
        nextOperator = PauliOperator.I;
    }

    // Find the first row in parity check matrix that matches currentOperator on leg_index
    const baseRepresentative =
      clickedLego.parity_check_matrix.find((row) => {
        if (nextOperator === PauliOperator.X) {
          return row[leg_index] === 1 && row[leg_index + numQubits] === 0;
        } else if (nextOperator === PauliOperator.Z) {
          return row[leg_index] === 0 && row[leg_index + numQubits] === 1;
        }
        return false;
      }) || new Array(2 * numQubits).fill(0);

    // Find the row index that corresponds to the baseRepresentative
    const rowIndex = clickedLego.parity_check_matrix.findIndex((row) =>
      row.every((val, idx) => val === baseRepresentative[idx])
    );

    // Update the selected rows based on the pushed legs
    const selectedRows = [rowIndex].filter((row) => row !== -1);

    // Create a new lego instance with updated properties
    const updatedLego = clickedLego.with({
      selectedMatrixRows: selectedRows
    });

    // Update the selected tensornetwork state
    get().setTensorNetwork(
      new TensorNetwork({ legos: [updatedLego], connections: [] })
    );

    // Update droppedLegos by replacing the old lego with the new one
    const newDroppedLegos = get().droppedLegos.map((lego) =>
      lego.instance_id === legoId ? updatedLego : lego
    );
    get().setDroppedLegos(newDroppedLegos);

    simpleAutoFlow(
      updatedLego,
      newDroppedLegos,
      get().connections,
      get().setDroppedLegos
    );
  },

  handleLegMouseUp: (legoId, leg_index) => {
    const { legDragState, setLegDragState } = get();
    const {
      connections,
      updateLegoConnectivity,
      addOperation,
      addConnections
    } = get();
    const lego = get().droppedLegos.find((lego) => lego.instance_id === legoId);
    if (!lego) return;

    if (!legDragState) return;

    const isSourceLegConnected = get().connections.some(
      (conn) =>
        (conn.from.legoId === legDragState.legoId &&
          conn.from.leg_index === legDragState.leg_index) ||
        (conn.to.legoId === legDragState.legoId &&
          conn.to.leg_index === legDragState.leg_index)
    );
    const isTargetLegConnected = connections.some(
      (conn) =>
        (conn.from.legoId === lego.instance_id &&
          conn.from.leg_index === leg_index) ||
        (conn.to.legoId === lego.instance_id && conn.to.leg_index === leg_index)
    );

    if (
      lego.instance_id === legDragState.legoId &&
      leg_index === legDragState.leg_index
    ) {
      setLegDragState(null);
      updateLegoConnectivity(legDragState.legoId);

      return;
    }

    if (isSourceLegConnected || isTargetLegConnected) {
      get().setError("Cannot connect to a leg that is already connected");
      console.error("Cannot connect to a leg that is already connected");
      setLegDragState(null);
      updateLegoConnectivity(legDragState.legoId);

      return;
    }

    const connectionExists = connections.some(
      (conn) =>
        (conn.from.legoId === legDragState.legoId &&
          conn.from.leg_index === legDragState.leg_index &&
          conn.to.legoId === lego.instance_id &&
          conn.to.leg_index === leg_index) ||
        (conn.from.legoId === lego.instance_id &&
          conn.from.leg_index === leg_index &&
          conn.to.legoId === legDragState.legoId &&
          conn.to.leg_index === legDragState.leg_index)
    );

    if (!connectionExists) {
      const newConnection = new Connection(
        {
          legoId: legDragState.legoId,
          leg_index: legDragState.leg_index
        },
        {
          legoId: lego.instance_id,
          leg_index: leg_index
        }
      );

      addConnections([newConnection]);

      addOperation({
        type: "connect",
        data: { connectionsToAdd: [newConnection] }
      });
      setLegDragState(null);
      updateLegoConnectivity(legDragState.legoId);

      return;
    }

    setLegDragState(null);
    updateLegoConnectivity(legDragState.legoId);
  }
});
