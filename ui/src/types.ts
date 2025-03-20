import { LegoStyle } from "./LegoStyles"

export interface LegoPiece {
    id: string
    name: string
    shortName: string
    description: string
    is_dynamic?: boolean
    parameters?: Record<string, any>
    parity_check_matrix: number[][]
    logical_legs: number[]
    gauge_legs: number[]
}

export enum PauliOperator {
    X = 'X',
    Z = 'Z',
    Y = 'Y',
    I = 'I'
}

export interface PushedLeg {
    legIndex: number
    operator: PauliOperator
    // the symplectic representation of the pushed operator
    baseRepresentatitve: number[]
}

export interface DroppedLego extends LegoPiece {
    x: number
    y: number
    instanceId: string
    style: LegoStyle
    pushedLegs: PushedLeg[]
    selectedMatrixRows?: number[]
}


export interface Connection {
    from: {
        legoId: string
        legIndex: number
    }
    to: {
        legoId: string
        legIndex: number
    }
}

export interface TensorNetworkLeg {
    instanceId: string
    legIndex: number
}

export interface TensorNetwork {
    legos: DroppedLego[]
    connections: Connection[]
    parityCheckMatrix?: number[][]
    weightEnumerator?: string
    isCalculatingWeightEnumerator?: boolean
    constructionCode?: string
    legOrdering?: TensorNetworkLeg[]
}

export interface LegDragState {
    isDragging: boolean
    legoId: string
    legIndex: number
    startX: number
    startY: number
    currentX: number
    currentY: number
}

export interface DragState {
    isDragging: boolean
    draggedLegoIndex: number
    startX: number
    startY: number
    originalX: number
    originalY: number
    justFinished: boolean
}

export interface SelectionBoxState {
    isSelecting: boolean
    startX: number
    startY: number
    currentX: number
    currentY: number
    justFinished: boolean
}


// Add a new interface for group drag state
export interface GroupDragState {
    legoInstanceIds: string[];
    originalPositions: { [instanceId: string]: { x: number; y: number } };
}



export type Operation = {
    type: 'add' | 'remove' | 'move' | 'connect' | 'disconnect' | 'fuse' | 'unfuse';
    data: {
        legos?: DroppedLego[];
        connections?: Connection[];
        legoInstanceId?: string;
        oldX?: number;
        oldY?: number;
        newX?: number;
        newY?: number;
        groupMoves?: { legoInstanceId: string; oldX: number; oldY: number; newX: number; newY: number; }[];
        oldLegos?: DroppedLego[];
        oldConnections?: Connection[];
        newLego?: DroppedLego;
        newLegos?: DroppedLego[];
        newConnections?: Connection[];
    };
};

export interface SelectionBoxState {
    isSelecting: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    justFinished: boolean;  // New flag to track if selection box just finished
}


export interface CanvasState {
    pieces: Array<{
        id: string
        instanceId: string
        x: number
        y: number
        is_dynamic?: boolean
        parameters?: Record<string, any>
        parity_check_matrix?: number[][]
        logical_legs?: number[]
        gauge_legs?: number[]
    }>
    connections: Array<Connection>
    hideConnectedLegs: boolean
}

export interface LegoServerPayload {
    instanceId: string;
    id: string;
    name: string;
    shortName: string;
    description?: string;
    is_dynamic?: boolean;
    parameters?: Record<string, any>;
    parity_check_matrix: number[][];
    logical_legs: number[];
    gauge_legs: number[];
}
