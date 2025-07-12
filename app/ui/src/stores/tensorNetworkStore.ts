import { StateCreator } from "zustand";
import { TensorNetwork, TensorNetworkLeg } from "../lib/TensorNetwork";
import { CanvasStore } from "./canvasStateStore";
import { PauliOperator } from "../lib/types";
import { DroppedLego } from "./droppedLegoStore";

export interface TensorNetworkSlice {
  tensorNetwork: TensorNetwork | null;
  setTensorNetwork: (network: TensorNetwork | null) => void;
  highlightTensorNetworkLegs: (selectedRows: number[]) => void;
  highlightedTensorNetworkLegs: {
    leg: TensorNetworkLeg;
    operator: PauliOperator;
  }[];
}

export const useTensorNetworkSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  TensorNetworkSlice
> = (set, get) => ({
  tensorNetwork: null,
  highlightedTensorNetworkLegs: [],

  setTensorNetwork: (network) => {
    set({ tensorNetwork: network });
  },
  highlightTensorNetworkLegs: (selectedRows: number[]) => {
    if (!get().tensorNetwork) return;
    const h = get().tensorNetwork?.parity_check_matrix;
    const legOrdering = get().tensorNetwork?.legOrdering;
    console.log("highlightTensorNetworkLegs", selectedRows);

    console.log("h", h);
    console.log("legOrdering", legOrdering);

    if (!h || !legOrdering) return;

    const updatedDroppedLegos = new Map<string, DroppedLego>();

    const previousHighlightedTensorNetworkLegs =
      get().highlightedTensorNetworkLegs;

    for (const highlightedLeg of previousHighlightedTensorNetworkLegs) {
      const droppedLego = updatedDroppedLegos.has(
        highlightedLeg.leg.instance_id
      )
        ? updatedDroppedLegos.get(highlightedLeg.leg.instance_id)!
        : get().droppedLegos.find(
            (l) => l.instance_id === highlightedLeg.leg.instance_id
          )!;

      updatedDroppedLegos.set(
        highlightedLeg.leg.instance_id,
        droppedLego.with({ highlightedLegConstraints: [] })
      );
    }

    if (selectedRows.length === 0) {
      set({ highlightedTensorNetworkLegs: [] });
      get().updateDroppedLegos(Array.from(updatedDroppedLegos.values()));
      return;
    }
    const combinedRow = new Array(h[0].length).fill(0);

    console.log("h", h);
    console.log("legOrdering", legOrdering);
    console.log("combinedRow", combinedRow);

    for (const rowIndex of selectedRows) {
      h[rowIndex].forEach((val, idx) => {
        combinedRow[idx] = (combinedRow[idx] + val) % 2;
      });
    }

    const highlightedTensorNetworkLegs = [];

    for (let leg_index = 0; leg_index < h[0].length / 2; leg_index++) {
      const xPart = combinedRow[leg_index];
      const zPart = combinedRow[leg_index + h[0].length / 2];
      if (xPart === 1 && zPart === 0) {
        highlightedTensorNetworkLegs.push({
          leg: legOrdering[leg_index],
          operator: PauliOperator.X
        });
      } else if (xPart === 0 && zPart === 1) {
        highlightedTensorNetworkLegs.push({
          leg: legOrdering[leg_index],
          operator: PauliOperator.Z
        });
      } else if (xPart === 1 && zPart === 1) {
        highlightedTensorNetworkLegs.push({
          leg: legOrdering[leg_index],
          operator: PauliOperator.Y
        });
      }
    }

    set({ highlightedTensorNetworkLegs });
    for (const highlightedLeg of highlightedTensorNetworkLegs) {
      const droppedLego = updatedDroppedLegos.has(
        highlightedLeg.leg.instance_id
      )
        ? updatedDroppedLegos.get(highlightedLeg.leg.instance_id)!
        : get().droppedLegos.find(
            (l) => l.instance_id === highlightedLeg.leg.instance_id
          )!;

      updatedDroppedLegos.set(
        highlightedLeg.leg.instance_id,
        droppedLego.with({
          highlightedLegConstraints: [
            ...droppedLego.highlightedLegConstraints,
            {
              legIndex: highlightedLeg.leg.leg_index,
              operator: highlightedLeg.operator
            }
          ]
        })
      );
    }
    console.log("updatedDroppedLegos", updatedDroppedLegos);
    get().updateDroppedLegos(Array.from(updatedDroppedLegos.values()));
  }
});
