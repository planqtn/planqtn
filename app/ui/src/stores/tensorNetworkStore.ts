import { StateCreator } from "zustand";
import { TensorNetwork, TensorNetworkLeg } from "../lib/TensorNetwork";
import { CanvasStore } from "./canvasStateStore";
import { PauliOperator } from "../lib/types";
import { DroppedLego } from "./droppedLegoStore";
import { useToast } from "@chakra-ui/react";
import { User } from "@supabase/supabase-js";
import { getAccessToken } from "../features/auth/auth";
import { getApiUrl } from "../config/config";
import { config } from "../config/config";

export class WeightEnumerator {
  taskId?: string;
  polynomial?: string;
  normalizerPolynomial?: string;
  truncateLength?: number;
  openLegs: TensorNetworkLeg[];

  constructor(data: {
    taskId?: string;
    polynomial?: string;
    normalizerPolynomial?: string;
    truncateLength?: number;
    openLegs: TensorNetworkLeg[];
  }) {
    this.taskId = data.taskId;
    this.polynomial = data.polynomial;
    this.normalizerPolynomial = data.normalizerPolynomial;
    this.truncateLength = data.truncateLength;
    this.openLegs = data.openLegs;
  }

  public equalArgs(other: WeightEnumerator): boolean {
    return (
      this.truncateLength === other.truncateLength &&
      this.openLegs.length === other.openLegs.length &&
      this.openLegs.every((leg) => other.openLegs.includes(leg))
    );
  }

  public with(data: Partial<WeightEnumerator>): WeightEnumerator {
    return new WeightEnumerator({
      ...this,
      ...data
    });
  }
}

export interface ParityCheckMatrix {
  matrix: number[][];
  legOrdering: TensorNetworkLeg[];
}

export interface TensorNetworkSlice {
  /* State */

  // the selected legos and their connections
  tensorNetwork: TensorNetwork | null;

  // parity check matrix for each tensor network
  parityCheckMatrices: Record<string, ParityCheckMatrix>;
  // weight enumerators for each tensor network
  weightEnumerators: Record<string, WeightEnumerator[]>;
  // which
  highlightedTensorNetworkLegs: Record<
    string,
    {
      leg: TensorNetworkLeg;
      operator: PauliOperator;
    }[]
  >;

  selectedRows: Record<string, number[]>;

  /* Setters / Mutators */

  setTensorNetwork: (network: TensorNetwork | null) => void;

  setParityCheckMatrix: (
    networkSignature: string,
    parityCheckMatrix: ParityCheckMatrix
  ) => void;
  setWeightEnumerator: (
    networkSignature: string,
    taskId: string,
    weightEnumerator: WeightEnumerator
  ) => void;
  highlightTensorNetworkLegs: (selectedRows: number[]) => void;

  /* Getters / Accessors */

  getParityCheckMatrix: (networkSignature: string) => ParityCheckMatrix | null;
  listWeightEnumerators: (networkSignature: string) => WeightEnumerator[];
  getWeightEnumerator: (
    networkSignature: string,
    taskId: string
  ) => WeightEnumerator | null;
  deleteWeightEnumerator: (networkSignature: string, taskId: string) => void;

  getLegoHighlightedLegConstraints: (leg: DroppedLego) => {
    legIndex: number;
    operator: PauliOperator;
  }[];

  calculateWeightEnumerator: (
    currentUser: User,
    toast: ReturnType<typeof useToast>,
    truncateLength?: number,
    openLegs?: TensorNetworkLeg[]
  ) => Promise<void>;
}

export const useTensorNetworkSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  TensorNetworkSlice
> = (set, get) => ({
  tensorNetwork: null,
  // parity check matrix for each tensor network
  parityCheckMatrices: {},
  // weight enumerators for each tensor network
  weightEnumerators: {},
  highlightedTensorNetworkLegs: {},
  selectedRows: {},

  getParityCheckMatrix: (networkSignature: string) => {
    return get().parityCheckMatrices[networkSignature] || null;
  },
  listWeightEnumerators: (networkSignature: string) => {
    return get().weightEnumerators[networkSignature] || [];
  },
  getWeightEnumerator: (networkSignature: string, taskId: string) => {
    return (
      get().weightEnumerators[networkSignature]?.find(
        (enumerator) => enumerator.taskId === taskId
      ) || null
    );
  },
  deleteWeightEnumerator: (networkSignature: string, taskId: string) => {
    get().weightEnumerators[networkSignature]?.filter(
      (enumerator) => enumerator.taskId !== taskId
    );
  },

  getLegoHighlightedLegConstraints: (leg: DroppedLego) => {
    return Object.values(get().highlightedTensorNetworkLegs)
      .flat()
      .filter(
        (highlightedLeg) => highlightedLeg.leg.instance_id === leg.instance_id
      )
      .map((highlightedLeg) => ({
        legIndex: highlightedLeg.leg.leg_index,
        operator: highlightedLeg.operator
      }));
  },

  setParityCheckMatrix: (
    networkSignature: string,
    parityCheckMatrix: ParityCheckMatrix
  ) => {
    set((state) => {
      state.parityCheckMatrices[networkSignature] = parityCheckMatrix;
    });
  },

  setWeightEnumerator: (
    networkSignature: string,
    taskId: string,
    weightEnumerator: WeightEnumerator
  ) => {
    set((state) => {
      const weightEnumerators = state.weightEnumerators[networkSignature];
      const index = weightEnumerators?.findIndex(
        (enumerator) => enumerator.taskId === taskId
      );
      if (weightEnumerators && index !== undefined) {
        weightEnumerators[index] = weightEnumerator;
      } else if (weightEnumerators) {
        weightEnumerators.push(weightEnumerator);
      } else {
        state.weightEnumerators[networkSignature] = [weightEnumerator];
      }
      return state;
    });
  },

  setTensorNetwork: (network) => {
    // console.log("setTensorNetwork", new Error("debug").stack);
    set({ tensorNetwork: network });
  },

  highlightTensorNetworkLegs: (selectedRows: number[]) => {
    const tensorNetwork = get().tensorNetwork;
    if (!tensorNetwork) return;

    let updatedDroppedLegos: DroppedLego[] = [];

    set((state) => {
      state.selectedRows[tensorNetwork.signature] = selectedRows;
      const parityCheckMatrix = get().getParityCheckMatrix(
        tensorNetwork.signature
      );
      console.log("highlightTensorNetworkLegs", selectedRows);
      console.log("h", parityCheckMatrix?.matrix);
      console.log("legOrdering", parityCheckMatrix?.legOrdering);

      if (!parityCheckMatrix) return;
      const h = parityCheckMatrix.matrix;
      const legOrdering = parityCheckMatrix.legOrdering;

      const updatedDroppedLegosMap = new Map<string, DroppedLego>();

      const previousHighlightedTensorNetworkLegs =
        state.highlightedTensorNetworkLegs[tensorNetwork.signature] || [];

      for (const highlightedLeg of previousHighlightedTensorNetworkLegs) {
        const droppedLego = updatedDroppedLegosMap.has(
          highlightedLeg.leg.instance_id
        )
          ? updatedDroppedLegosMap.get(highlightedLeg.leg.instance_id)!
          : get().droppedLegos.find(
              (l) => l.instance_id === highlightedLeg.leg.instance_id
            )!;

        updatedDroppedLegosMap.set(
          highlightedLeg.leg.instance_id,
          droppedLego.with({ highlightedLegConstraints: [] })
        );
      }

      if (selectedRows.length === 0) {
        state.highlightedTensorNetworkLegs[tensorNetwork.signature] = [];
        updatedDroppedLegos = Array.from(updatedDroppedLegosMap.values());
        return;
      }
      const combinedRow = new Array(h[0].length).fill(0);

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

      state.highlightedTensorNetworkLegs[tensorNetwork.signature] =
        highlightedTensorNetworkLegs;

      for (const highlightedLeg of highlightedTensorNetworkLegs) {
        const droppedLego = updatedDroppedLegosMap.has(
          highlightedLeg.leg.instance_id
        )
          ? updatedDroppedLegosMap.get(highlightedLeg.leg.instance_id)!
          : get().droppedLegos.find(
              (l) => l.instance_id === highlightedLeg.leg.instance_id
            )!;

        updatedDroppedLegosMap.set(
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
      updatedDroppedLegos = Array.from(updatedDroppedLegosMap.values());
    });

    // Update the dropped legos outside of the set function to avoid nested state updates
    if (updatedDroppedLegos.length > 0) {
      get().updateDroppedLegos(updatedDroppedLegos);
    }
  },

  calculateWeightEnumerator: async (
    currentUser: User,
    toast: ReturnType<typeof useToast>,
    truncateLength?: number,
    openLegs?: TensorNetworkLeg[]
  ): Promise<void> => {
    const tensorNetwork = get().tensorNetwork;
    if (!tensorNetwork) return;

    const newEnumerator = new WeightEnumerator({
      truncateLength: truncateLength,
      openLegs: openLegs || []
    });

    const cachedEnumerator = get()
      .listWeightEnumerators(tensorNetwork.signature)
      .find((enumerator: WeightEnumerator) =>
        enumerator.equalArgs(newEnumerator)
      );

    if (cachedEnumerator) {
      // we already calculated this weight enumerator
      toast({
        title: "Weight enumerator already calculated",
        description: `The weight enumerator has already been calculated. See task id: ${cachedEnumerator.taskId}`,
        status: "info",
        duration: 5000,
        isClosable: true
      });
      return;
    }

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Failed to get access token");
      }

      const response = await fetch(getApiUrl("planqtnJob"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          user_id: currentUser?.id,
          request_time: new Date().toISOString(),
          job_type: "weightenumerator",
          task_store_url: config.userContextURL,
          task_store_anon_key: config.userContextAnonKey,
          payload: {
            legos: tensorNetwork.legos.reduce(
              (acc, lego) => {
                acc[lego.instance_id] = {
                  instance_id: lego.instance_id,
                  short_name: lego.short_name || "Generic Lego",
                  name: lego.short_name || "Generic Lego",
                  type_id: lego.type_id,
                  parity_check_matrix: lego.parity_check_matrix,
                  logical_legs: lego.logical_legs,
                  gauge_legs: lego.gauge_legs
                };
                return acc;
              },
              {} as Record<string, unknown>
            ),
            connections: tensorNetwork.connections,
            truncate_length: truncateLength,
            open_legs: openLegs || []
          }
        })
      });

      const data = await response.json();

      if (data.status === "error") {
        throw new Error(data.message);
      }

      const taskId = data.task_id;

      get().setWeightEnumerator(
        tensorNetwork.signature,
        taskId,
        newEnumerator.with({ taskId })
      );

      toast({
        title: "Success starting the task!",
        description: "Weight enumerator calculation has been started.",
        status: "success",
        duration: 5000,
        isClosable: true
      });
    } catch (err) {
      console.error("Error calculating weight enumerator:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      get().setError(`Failed to calculate weight enumerator: ${errorMessage}`);
    }
  }
});
