import { LegoStyle } from "../LegoStyles";

export interface LegoPiece {
  id: string;
  name: string;
  shortName: string;
  description: string;
  is_dynamic?: boolean;
  parameters?: Record<string, unknown>;
  parity_check_matrix: number[][];
  logical_legs: number[];
  gauge_legs: number[];
}

export enum PauliOperator {
  X = "X",
  Z = "Z",
  Y = "Y",
  I = "I"
}

export interface DroppedLego extends LegoPiece {
  x: number;
  y: number;
  instanceId: string;
  style: LegoStyle;
  selectedMatrixRows: number[];
  alwaysShowLegs?: boolean;
}

export class Connection {
  constructor(
    public from: {
      legoId: string;
      legIndex: number;
    },
    public to: {
      legoId: string;
      legIndex: number;
    }
  ) {}

  public equals(other: Connection): boolean {
    return (
      (this.from.legoId === other.from.legoId &&
        this.from.legIndex === other.from.legIndex &&
        this.to.legoId === other.to.legoId &&
        this.to.legIndex === other.to.legIndex) ||
      (this.from.legoId === other.to.legoId &&
        this.from.legIndex === other.to.legIndex &&
        this.to.legoId === other.from.legoId &&
        this.to.legIndex === other.from.legIndex)
    );
  }

  public containsLego(legoId: string): boolean {
    return this.from.legoId === legoId || this.to.legoId === legoId;
  }
  public containsLeg(legoId: string, legIndex: number): boolean {
    return (
      (this.from.legoId === legoId && this.from.legIndex === legIndex) ||
      (this.to.legoId === legoId && this.to.legIndex === legIndex)
    );
  }
}

export interface LegDragState {
  isDragging: boolean;
  legoId: string;
  legIndex: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface DragState {
  isDragging: boolean;
  draggedLegoIndex: number;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
  justFinished: boolean;
}

export interface CanvasDragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface SelectionBoxState {
  isSelecting: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  justFinished: boolean;
}

// Add a new interface for group drag state
export interface GroupDragState {
  legoInstanceIds: string[];
  originalPositions: { [instanceId: string]: { x: number; y: number } };
}

export type OperationType =
  | "add"
  | "remove"
  | "move"
  | "connect"
  | "disconnect"
  | "fuse"
  | "unfuseToLegs"
  | "unfuseInto2Legos"
  | "colorChange"
  | "pullOutOppositeLeg"
  | "injectTwoLegged"
  | "bialgebra"
  | "inverseBialgebra"
  | "hopf"
  | "addStopper"
  | "connectGraphNodesWithCenterLego"
  | "completeGraphViaHadamards";

export type Operation = {
  type: OperationType;
  data: {
    legosToAdd?: DroppedLego[];
    legosToRemove?: DroppedLego[];
    legosToUpdate?: { oldLego: DroppedLego; newLego: DroppedLego }[];
    connectionsToAdd?: Connection[];
    connectionsToRemove?: Connection[];
  };
};

export interface SelectionBoxState {
  isSelecting: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  justFinished: boolean; // New flag to track if selection box just finished
}

export interface CanvasState {
  pieces: Array<{
    id: string;
    instanceId: string;
    x: number;
    y: number;
    is_dynamic?: boolean;
    parameters?: Record<string, unknown>;
    parity_check_matrix?: number[][];
    logical_legs?: number[];
    gauge_legs?: number[];
    selectedMatrixRows?: number[];
  }>;
  connections: Array<Connection>;
  hideConnectedLegs: boolean;
}

export interface LegoServerPayload {
  instanceId: string;
  id: string;
  name: string;
  shortName: string;
  description?: string;
  is_dynamic?: boolean;
  parameters?: Record<string, unknown>;
  parity_check_matrix: number[][];
  logical_legs: number[];
  gauge_legs: number[];
}

export interface TaskUpdateIterationStatus {
  desc: string;
  total_size: number;
  current_item: number;
  start_time: number;
  end_time: number | null;
  duration: number;
  avg_time_per_item: number;
}

export interface TaskUpdate {
  updates: {
    state: number;
    iteration_status: Array<TaskUpdateIterationStatus>;
  };
}

export interface Task {
  uuid: string;
  user_id: string;
  sent_at: string;
  started_at: string | null;
  ended_at: string | null;
  args: string;
  state: number;
  result: string | null;
  execution_id: string;
  job_type: string;
}
