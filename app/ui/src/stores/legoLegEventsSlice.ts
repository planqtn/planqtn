import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { Connection, PauliOperator } from "../lib/types";
import { TensorNetwork } from "../lib/TensorNetwork";
import { simpleAutoFlow } from "../transformations/AutoPauliFlow";

export interface LegoLegEventsSlice {
  handleLegMouseDown: (
    legoId: string,
    legIndex: number,
    x: number,
    y: number
  ) => void;

  handleLegClick: (legoId: string, legIndex: number) => void;
  handleLegMouseUp: (legoId: string, legIndex: number) => void;
}

export const useLegoLegEventsSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  LegoLegEventsSlice
> = (_, get) => ({
  handleLegMouseDown: (legoId, legIndex, x, y) => {
    get().temporarilyConnectLego(legoId);

    get().setLegDragState({
      isDragging: true,
      legoId,
      legIndex,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    });
  },

  handleLegClick: (legoId, legIndex) => {
    // Find the lego that was clicked
    const clickedLego = get().droppedLegos.find(
      (lego) => lego.instanceId === legoId
    );
    if (!clickedLego) return;
    const numQubits = clickedLego.numberOfLegs;
    const h = clickedLego.parity_check_matrix;
    const existingPushedLeg = clickedLego.selectedMatrixRows?.find(
      (row) => h[row][legIndex] == 1 || h[row][legIndex + numQubits] == 1
    );
    const currentOperator = existingPushedLeg
      ? h[existingPushedLeg][legIndex] == 1
        ? PauliOperator.X
        : PauliOperator.Z
      : PauliOperator.I;

    // Find available operators in parity check matrix for this leg
    const hasX = clickedLego.parity_check_matrix.some(
      (row) => row[legIndex] === 1 && row[legIndex + numQubits] === 0
    );
    const hasZ = clickedLego.parity_check_matrix.some(
      (row) => row[legIndex] === 0 && row[legIndex + numQubits] === 1
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

    // Find the first row in parity check matrix that matches currentOperator on legIndex
    const baseRepresentative =
      clickedLego.parity_check_matrix.find((row) => {
        if (nextOperator === PauliOperator.X) {
          return row[legIndex] === 1 && row[legIndex + numQubits] === 0;
        } else if (nextOperator === PauliOperator.Z) {
          return row[legIndex] === 0 && row[legIndex + numQubits] === 1;
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
      lego.instanceId === legoId ? updatedLego : lego
    );
    get().setDroppedLegos(newDroppedLegos);

    simpleAutoFlow(
      updatedLego,
      newDroppedLegos,
      get().connections,
      get().setDroppedLegos
    );
  },

  handleLegMouseUp: (legoId, legIndex) => {
    const { legDragState, setLegDragState } = get();
    const {
      connections,
      updateLegoConnectivity,
      addOperation,
      addConnections
    } = get();
    const lego = get().droppedLegos.find((lego) => lego.instanceId === legoId);
    if (!lego) return;

    if (!legDragState) return;

    const isSourceLegConnected = get().connections.some(
      (conn) =>
        (conn.from.legoId === legDragState.legoId &&
          conn.from.legIndex === legDragState.legIndex) ||
        (conn.to.legoId === legDragState.legoId &&
          conn.to.legIndex === legDragState.legIndex)
    );
    const isTargetLegConnected = connections.some(
      (conn) =>
        (conn.from.legoId === lego.instanceId &&
          conn.from.legIndex === legIndex) ||
        (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex)
    );

    if (
      lego.instanceId === legDragState.legoId &&
      legIndex === legDragState.legIndex
    ) {
      setLegDragState(null);
      updateLegoConnectivity(legDragState.legoId);

      return;
    }

    if (isSourceLegConnected || isTargetLegConnected) {
      //TODO: set error message
      // setError("Cannot connect to a leg that is already connected");
      console.error("Cannot connect to a leg that is already connected");
      setLegDragState(null);
      updateLegoConnectivity(legDragState.legoId);

      return;
    }

    const connectionExists = connections.some(
      (conn) =>
        (conn.from.legoId === legDragState.legoId &&
          conn.from.legIndex === legDragState.legIndex &&
          conn.to.legoId === lego.instanceId &&
          conn.to.legIndex === legIndex) ||
        (conn.from.legoId === lego.instanceId &&
          conn.from.legIndex === legIndex &&
          conn.to.legoId === legDragState.legoId &&
          conn.to.legIndex === legDragState.legIndex)
    );

    if (!connectionExists) {
      const newConnection = new Connection(
        {
          legoId: legDragState.legoId,
          legIndex: legDragState.legIndex
        },
        {
          legoId: lego.instanceId,
          legIndex: legIndex
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
