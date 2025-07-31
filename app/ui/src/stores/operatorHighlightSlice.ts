import { StateCreator } from "zustand";
import { DroppedLego } from "./droppedLegoStore";
import { PauliOperator } from "../lib/types";
import { simpleAutoFlow } from "../transformations/AutoPauliFlow";
import { CanvasStore } from "./canvasStateStore";

export interface OperatorHighlightSlice {
  // Single lego matrix operations
  handleSingleLegoMatrixRowSelection: (
    lego: DroppedLego,
    newSelectedRows: number[]
  ) => void;
  handleSingleLegoMatrixChange: (
    lego: DroppedLego,
    newMatrix: number[][]
  ) => void;
  calculateSingleLegoHighlightedLegConstraints: (
    matrix: number[][],
    selectedRows: number[]
  ) => { legIndex: number; operator: PauliOperator }[];
  handleMultiLegoMatrixChange: (
    signature: string,
    newMatrix: number[][]
  ) => void;
}

export const createOperatorHighlightSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  OperatorHighlightSlice
> = (_, get) => ({
  handleSingleLegoMatrixRowSelection: (
    lego: DroppedLego,
    newSelectedRows: number[]
  ) => {
    const updateDroppedLego = get().updateDroppedLego;
    const droppedLegos = get().droppedLegos;
    const connections = get().connections;
    const setDroppedLegos = get().setDroppedLegos;

    const updatedLego = new DroppedLego(
      lego,
      lego.logicalPosition,
      lego.instance_id,
      { selectedMatrixRows: newSelectedRows }
    );

    updateDroppedLego(updatedLego.instance_id, updatedLego);

    simpleAutoFlow(
      updatedLego,
      droppedLegos.map((l: DroppedLego) =>
        l.instance_id === updatedLego.instance_id ? updatedLego : l
      ),
      connections,
      setDroppedLegos
    );
  },

  handleSingleLegoMatrixChange: (lego: DroppedLego, newMatrix: number[][]) => {
    const updateDroppedLego = get().updateDroppedLego;
    const droppedLegos = get().droppedLegos;
    const connections = get().connections;
    const setDroppedLegos = get().setDroppedLegos;

    const updatedLego = new DroppedLego(
      lego,
      lego.logicalPosition,
      lego.instance_id,
      { parity_check_matrix: newMatrix }
    );
    updateDroppedLego(updatedLego.instance_id, updatedLego);
    simpleAutoFlow(
      updatedLego,
      droppedLegos.map((l: DroppedLego) =>
        l.instance_id === updatedLego.instance_id ? updatedLego : l
      ),
      connections,
      setDroppedLegos
    );
  },

  calculateSingleLegoHighlightedLegConstraints: (
    matrix: number[][],
    selectedRows: number[]
  ): { legIndex: number; operator: PauliOperator }[] => {
    const highlightedLegConstraints = [];

    if (selectedRows.length > 0) {
      const combinedRow = new Array(matrix[0].length).fill(0);

      for (const rowIndex of selectedRows) {
        matrix[rowIndex].forEach((val, idx) => {
          combinedRow[idx] = (combinedRow[idx] + val) % 2;
        });
      }

      // Convert the combined row to leg constraints
      for (let leg_index = 0; leg_index < matrix[0].length / 2; leg_index++) {
        const xPart = combinedRow[leg_index];
        const zPart = combinedRow[leg_index + matrix[0].length / 2];

        if (xPart === 1 && zPart === 0) {
          highlightedLegConstraints.push({
            legIndex: leg_index,
            operator: PauliOperator.X
          });
        } else if (xPart === 0 && zPart === 1) {
          highlightedLegConstraints.push({
            legIndex: leg_index,
            operator: PauliOperator.Z
          });
        } else if (xPart === 1 && zPart === 1) {
          highlightedLegConstraints.push({
            legIndex: leg_index,
            operator: PauliOperator.Y
          });
        }
      }
    }

    return highlightedLegConstraints;
  },

  // Memoized callbacks for ParityCheckMatrixDisplay
  handleMultiLegoMatrixChange: (signature: string, newMatrix: number[][]) => {
    const pcm = get().parityCheckMatrices[signature];
    if (!pcm) return;

    get().setParityCheckMatrix(signature, {
      matrix: newMatrix,
      legOrdering: pcm.legOrdering
    });
  }
});
