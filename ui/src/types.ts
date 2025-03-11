import { LegoStyle } from "./LegoStyles"

export interface LegoPiece {
    id: string
    name: string
    shortName: string
    type: string
    description: string
    is_dynamic?: boolean
    parameters?: Record<string, any>
    parity_check_matrix: number[][]
    logical_legs: number[]
    gauge_legs: number[]
}

export interface DroppedLego extends LegoPiece {
    x: number
    y: number
    instanceId: string
    style: LegoStyle
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

export interface SelectedNetwork {
    legos: DroppedLego[]
    connections: Connection[]
    parityCheckMatrix?: number[][]
    weightEnumerator?: string
    isCalculatingWeightEnumerator?: boolean
    constructionCode?: string
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



export interface Operation {
    type: 'add' | 'remove' | 'move' | 'connect' | 'disconnect';
    data: {
        legos?: DroppedLego[];
        connections?: Connection[];
        legoInstanceId?: string;
        oldX?: number;
        oldY?: number;
        newX?: number;
        newY?: number;
        groupMoves?: Array<{
            legoInstanceId: string;
            oldX: number;
            oldY: number;
            newX: number;
            newY: number;
        }>;
    };
}

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
    }>
    connections: Array<Connection>
}
