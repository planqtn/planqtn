import { TensorNetworkLeg } from "../../lib/TensorNetwork";
import { PauliOperator } from "../../lib/types";
import { Viewport } from "../../stores/canvasUISlice";
import { Connection } from "../../stores/connectionStore";
import {
  ParityCheckMatrix,
  WeightEnumerator
} from "../../stores/tensorNetworkStore";

export interface SerializedCachedTensorNetwork {
  isActive: boolean;
  tensorNetwork: {
    legos: Array<SerializedLego>;
    connections: Array<Connection>;
    signature: string;
  };
  svg: string;
  name: string;
  isLocked: boolean;
  lastUpdated: Date;
}

export interface SerializedLego {
  id: string;
  name?: string;
  short_name?: string;
  description?: string;
  instance_id: string;
  x: number;
  y: number;
  is_dynamic?: boolean;
  parameters?: Record<string, unknown>;
  parity_check_matrix?: number[][];
  logical_legs?: number[];
  gauge_legs?: number[];
  selectedMatrixRows?: number[];
  highlightedLegConstraints?: {
    legIndex: number;
    operator: PauliOperator;
  }[];
}

export interface SerializableCanvasState {
  title: string;
  pieces: Array<SerializedLego>;
  connections: Array<Connection>;
  hideConnectedLegs: boolean;
  hideIds: boolean;
  hideTypeIds: boolean;
  hideDanglingLegs: boolean;
  hideLegLabels: boolean;
  viewport: Viewport;
  parityCheckMatrices: { key: string; value: ParityCheckMatrix }[];
  weightEnumerators: { key: string; value: WeightEnumerator[] }[];
  cachedTensorNetworks: { key: string; value: SerializedCachedTensorNetwork }[];
  highlightedTensorNetworkLegs: {
    key: string;
    value: {
      leg: TensorNetworkLeg;
      operator: PauliOperator;
    }[];
  }[];
  selectedTensorNetworkParityCheckMatrixRows: {
    key: string;
    value: number[];
  }[];
  parity_check_matrix_table?: { key: string; value: number[][] }[];
  // Z-index management
  nextZIndex?: number;
}
