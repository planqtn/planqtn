import { TensorNetworkLeg } from "../../lib/TensorNetwork";
import { PauliOperator } from "../../lib/types";
import { Viewport } from "../../stores/canvasUISlice";
import { Connection } from "../../stores/connectionStore";
import {
  ParityCheckMatrix,
  WeightEnumerator
} from "../../stores/tensorNetworkStore";

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
  // Floating panel configurations
  buildingBlocksPanelConfig?: {
    id: string;
    title: string;
    isOpen: boolean;
    isCollapsed: boolean;
    layout: {
      position: { x: number; y: number };
      size: { width: number; height: number };
    };
    minWidth?: number;
    minHeight?: number;
    defaultWidth?: number;
    defaultHeight?: number;
    defaultPosition?: { x: number; y: number };
  };
  detailsPanelConfig?: {
    id: string;
    title: string;
    isOpen: boolean;
    isCollapsed: boolean;
    layout: {
      position: { x: number; y: number };
      size: { width: number; height: number };
    };
    minWidth?: number;
    minHeight?: number;
    defaultWidth?: number;
    defaultHeight?: number;
    defaultPosition?: { x: number; y: number };
  };
  canvasesPanelConfig?: {
    id: string;
    title: string;
    isOpen: boolean;
    isCollapsed: boolean;
    layout: {
      position: { x: number; y: number };
      size: { width: number; height: number };
    };
    minWidth?: number;
    minHeight?: number;
    defaultWidth?: number;
    defaultHeight?: number;
    defaultPosition?: { x: number; y: number };
  };
  taskPanelConfig?: {
    id: string;
    title: string;
    isOpen: boolean;
    isCollapsed: boolean;
    layout: {
      position: { x: number; y: number };
      size: { width: number; height: number };
    };
    minWidth?: number;
    minHeight?: number;
    defaultWidth?: number;
    defaultHeight?: number;
    defaultPosition?: { x: number; y: number };
  };
}
