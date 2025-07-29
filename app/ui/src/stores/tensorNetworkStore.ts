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
import { Connection } from "./connectionStore";

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
      this.openLegs.every(
        (leg, i) =>
          leg.instance_id === other.openLegs[i].instance_id &&
          leg.leg_index === other.openLegs[i].leg_index
      )
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

export interface CachedTensorNetwork {
  isActive: boolean;
  tensorNetwork: TensorNetwork;
  svg: string;
  name: string;
  isLocked: boolean;
  lastUpdated: Date;
}

export interface TensorNetworkSlice {
  /* State */

  // the selected legos and their connections
  tensorNetwork: TensorNetwork | null;
  cachedTensorNetworks: Record<string, CachedTensorNetwork>;

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

  selectedTensorNetworkParityCheckMatrixRows: Record<string, number[]>;

  /* Setters / Mutators */

  setTensorNetwork: (network: TensorNetwork | null) => void;

  cacheTensorNetwork: (cachedTensorNetwork: CachedTensorNetwork) => void;
  getCachedTensorNetwork: (
    networkSignature: string
  ) => CachedTensorNetwork | null;
  updateIsActiveForCachedTensorNetworks: (
    changedLegoInstanceIds: string[],
    changedConnections: Connection[]
  ) => void;
  cloneCachedTensorNetwork: (networkSignature: string) => void;
  refreshAndSetCachedTensorNetworkFromCanvas: (
    networkSignature: string
  ) => void;
  updateCachedTensorNetworkName: (
    networkSignature: string,
    newName: string
  ) => void;

  unCacheTensorNetwork: (networkSignature: string) => void;
  unCachePCM: (networkSignature: string) => void;
  unCacheWeightEnumerator: (networkSignature: string, taskId: string) => void;

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

  calculateParityCheckMatrix: (
    onSuccess?: (networkSignature: string, networkName: string) => void
  ) => Promise<void>;
}

export const useTensorNetworkSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  TensorNetworkSlice
> = (set, get) => ({
  tensorNetwork: null,
  cachedTensorNetworks: {},
  // parity check matrix for each tensor network
  parityCheckMatrices: {},
  // weight enumerators for each tensor network
  weightEnumerators: {},
  highlightedTensorNetworkLegs: {},
  selectedTensorNetworkParityCheckMatrixRows: {},

  cacheTensorNetwork: (cachedTensorNetwork: CachedTensorNetwork) => {
    set((state) => {
      state.cachedTensorNetworks[cachedTensorNetwork.tensorNetwork.signature] =
        cachedTensorNetwork;
    });
  },
  unCacheTensorNetwork: (networkSignature: string) => {
    get().unCachePCM(networkSignature);
    set((state) => {
      delete state.cachedTensorNetworks[networkSignature];
      delete state.weightEnumerators[networkSignature];
    });
  },
  unCachePCM: (networkSignature: string) => {
    set((state) => {
      delete state.parityCheckMatrices[networkSignature];
      delete state.highlightedTensorNetworkLegs[networkSignature];
      delete state.selectedTensorNetworkParityCheckMatrixRows[networkSignature];
    });
  },
  unCacheWeightEnumerator: (networkSignature: string, taskId: string) => {
    set((state) => {
      const weightEnumerators = state.weightEnumerators[networkSignature];
      state.weightEnumerators[networkSignature] = weightEnumerators.filter(
        (enumerator) => enumerator.taskId !== taskId
      );
    });
  },
  getCachedTensorNetwork: (networkSignature: string) => {
    return get().cachedTensorNetworks[networkSignature] || null;
  },

  updateIsActiveForCachedTensorNetworks: (
    changedLegoInstanceIds: string[],
    changedConnections: Connection[]
  ) => {
    set((state) => {
      const allLegoIdsAffectedByChanges = Array.from(
        new Set([
          ...changedLegoInstanceIds,
          ...changedConnections.flatMap((c) => [c.from.legoId, c.to.legoId])
        ])
      );

      const changedTensorNetworks: CachedTensorNetwork[] = Object.values(
        get().cachedTensorNetworks
      ).filter((cachedTensorNetwork) =>
        allLegoIdsAffectedByChanges.some((instance_id) =>
          cachedTensorNetwork.tensorNetwork.legos.some(
            (l) => l.instance_id === instance_id
          )
        )
      );
      console.log(
        "changedTensorNetworks",
        changedTensorNetworks.map((t) => t.tensorNetwork.signature)
      );

      const canvasConns = get().connections;
      for (const cachedTensorNetwork of changedTensorNetworks) {
        const allLegosOnCanvas = cachedTensorNetwork.tensorNetwork.legos.every(
          (lego) =>
            get().droppedLegos.some((l) => l.instance_id === lego.instance_id)
        );

        const connectionsOnCanvasBetweenTNLegos = canvasConns.filter((c) => {
          let fromIsInTN = false;
          let toIsInTN = false;
          for (const lego of cachedTensorNetwork.tensorNetwork.legos) {
            if (lego.instance_id === c.from.legoId) {
              fromIsInTN = true;
            }
            if (lego.instance_id === c.to.legoId) {
              toIsInTN = true;
            }
            if (fromIsInTN && toIsInTN) {
              return true;
            }
          }
          return false;
        });
        const allConnectionsOnCanvas =
          cachedTensorNetwork.tensorNetwork.connections.every((connection) =>
            connectionsOnCanvasBetweenTNLegos.some((c) => c.equals(connection))
          );
        const noExtraConnectionsOnCanvas =
          connectionsOnCanvasBetweenTNLegos.length ===
          cachedTensorNetwork.tensorNetwork.connections.length;
        const isActive =
          allLegosOnCanvas &&
          allConnectionsOnCanvas &&
          noExtraConnectionsOnCanvas;

        state.cachedTensorNetworks[
          cachedTensorNetwork.tensorNetwork.signature
        ] = {
          ...cachedTensorNetwork,
          isActive: isActive
        };
      }
    });
  },

  cloneCachedTensorNetwork: (networkSignature: string) => {
    const cachedTensorNetwork = get().getCachedTensorNetwork(networkSignature);
    if (!cachedTensorNetwork) return;

    const { newLegos, newConnections } = get().cloneLegos(
      cachedTensorNetwork.tensorNetwork.legos,
      cachedTensorNetwork.tensorNetwork.connections
    );

    const newTensorNetwork = new TensorNetwork({
      legos: newLegos,
      connections: newConnections
    });

    get().cacheTensorNetwork({
      ...cachedTensorNetwork,
      tensorNetwork: newTensorNetwork,
      isActive: true,
      isLocked: false,
      lastUpdated: new Date(),
      svg: "<svg><rect width='100%' height='100%' fill='red'/></svg>",
      name: cachedTensorNetwork.name + " (clone)"
    });

    // clone all the calculations as well
    const weightEnumerators = get().listWeightEnumerators(networkSignature);
    for (const weightEnumerator of weightEnumerators) {
      get().setWeightEnumerator(
        newTensorNetwork.signature,
        weightEnumerator.taskId!,
        weightEnumerator
      );
    }

    // clone all the parity check matrices as well
    const parityCheckMatrix = get().getParityCheckMatrix(networkSignature);
    if (parityCheckMatrix) {
      get().setParityCheckMatrix(newTensorNetwork.signature, parityCheckMatrix);
    }
  },

  refreshAndSetCachedTensorNetworkFromCanvas: (networkSignature: string) => {
    const cachedTensorNetwork = get().getCachedTensorNetwork(networkSignature);
    if (!cachedTensorNetwork) return;

    const legosOnCanvas = cachedTensorNetwork.tensorNetwork.legos.map(
      (lego) =>
        get().droppedLegos.find((l) => l.instance_id === lego.instance_id)!
    );

    const newTensorNetwork = cachedTensorNetwork.tensorNetwork.with({
      legos: legosOnCanvas
    });

    set((state) => {
      state.tensorNetwork = newTensorNetwork;
      state.cachedTensorNetworks[networkSignature] = {
        ...cachedTensorNetwork,
        tensorNetwork: cachedTensorNetwork.tensorNetwork.with({
          legos: legosOnCanvas
        })
      };
    });
  },

  updateCachedTensorNetworkName: (
    networkSignature: string,
    newName: string
  ) => {
    set((state) => {
      const cachedNetwork = state.cachedTensorNetworks[networkSignature];
      if (cachedNetwork) {
        state.cachedTensorNetworks[networkSignature] = {
          ...cachedNetwork,
          name: newName
        };
      }
    });
  },

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
    set((state) => {
      const arr = state.weightEnumerators[networkSignature];
      if (arr) {
        state.weightEnumerators[networkSignature] = arr.filter(
          (enumerator) => enumerator.taskId !== taskId
        );
      }
      return state;
    });
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
      if (weightEnumerators && index !== undefined && index !== -1) {
        weightEnumerators[index] = weightEnumerator;
      } else if (weightEnumerators) {
        weightEnumerators.push(weightEnumerator);
      } else {
        state.weightEnumerators[networkSignature] = [weightEnumerator];
      }
      return state;
    });
  },

  setTensorNetwork: (network: TensorNetwork | null) => {
    console.log(
      "setTensorNetwork",
      network?.legos.map(
        (lego) => lego.logicalPosition.x + "," + lego.logicalPosition.y
      )
    );
    set({ tensorNetwork: network });
  },

  highlightTensorNetworkLegs: (selectedRows: number[]) => {
    const tensorNetwork = get().tensorNetwork;
    if (!tensorNetwork) return;

    let updatedDroppedLegos: DroppedLego[] = [];

    set((state) => {
      state.selectedTensorNetworkParityCheckMatrixRows[
        tensorNetwork.signature
      ] = selectedRows;
      const parityCheckMatrix = get().getParityCheckMatrix(
        tensorNetwork.signature
      );

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

      const cachedTensorNetwork = get().getCachedTensorNetwork(
        tensorNetwork.signature
      );

      get().cacheTensorNetwork({
        isActive: true,
        tensorNetwork: tensorNetwork,
        svg: `<svg><circle cx='100' cy='100' r='100' fill='red'/><text x='100' y='100' fill='white'>Hello updated ${new Date().toISOString()}</text></svg>`,
        name:
          cachedTensorNetwork?.name ||
          `"Subnet ${tensorNetwork.legos.length} legos | ${new Date().toISOString()}"`,
        isLocked: cachedTensorNetwork?.isLocked || false,
        lastUpdated: new Date()
      });

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
  },

  calculateParityCheckMatrix: async (
    onSuccess?: (networkSignature: string, networkName: string) => void
  ): Promise<void> => {
    const tensorNetwork = get().tensorNetwork;
    if (!tensorNetwork) return;

    try {
      // Create a TensorNetwork and perform the fusion
      const network = new TensorNetwork({
        legos: tensorNetwork.legos,
        connections: tensorNetwork.connections
      });
      const result = network.conjoin_nodes();

      if (!result) {
        throw new Error("Cannot compute tensor network parity check matrix");
      }

      const legOrdering = result.legs.map((leg) => ({
        instance_id: leg.instance_id,
        leg_index: leg.leg_index
      }));

      get().setParityCheckMatrix(tensorNetwork.signature, {
        matrix: result.h.getMatrix(),
        legOrdering
      });

      const cachedTensorNetwork = get().getCachedTensorNetwork(
        tensorNetwork.signature
      );

      get().cacheTensorNetwork({
        isActive: true,
        tensorNetwork: network,
        svg: `<svg><circle cx='100' cy='100' r='100' fill='red'/><text x='100' y='100' fill='white'>Hello updated ${new Date().toISOString()}</text></svg>`,
        name:
          cachedTensorNetwork?.name ||
          `${tensorNetwork.legos.length} legos | ${new Date().toISOString()}`,
        isLocked: cachedTensorNetwork?.isLocked || false,
        lastUpdated: new Date()
      });

      // Call success callback if provided
      const networkName =
        cachedTensorNetwork?.name || `${tensorNetwork.legos.length} legos`;
      onSuccess?.(tensorNetwork.signature, networkName);
    } catch (error) {
      console.error("Error calculating parity check matrix:", error);
      get().setError("Failed to calculate parity check matrix");
    }
  }
});
