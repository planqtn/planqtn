import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { Connection, SelectionBoxState } from "../lib/types";
import { LogicalPoint, CanvasPoint } from "../types/coordinates";

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export class Viewport {
  constructor(
    // Screen-space viewport (physical pixels)
    public screenWidth: number,
    public screenHeight: number,

    // Zoom and pan state
    public zoomLevel: number,
    public logicalPanOffset: LogicalPoint
  ) {}

  public get logicalWidth(): number {
    return this.screenWidth * this.zoomLevel;
  }

  public get screenWidthToHeightRatio(): number {
    return this.screenWidth / this.screenHeight;
  }

  public get logicalHeight(): number {
    return this.logicalWidth / this.screenWidthToHeightRatio;
  }

  public get logicalCenter(): LogicalPoint {
    return new LogicalPoint(this.logicalWidth / 2, this.logicalHeight / 2).plus(
      this.logicalPanOffset
    );
  }

  with(overrides: Partial<Viewport>): Viewport {
    return new Viewport(
      overrides.screenWidth || this.screenWidth,
      overrides.screenHeight || this.screenHeight,
      overrides.zoomLevel || this.zoomLevel,
      overrides.logicalPanOffset || this.logicalPanOffset
    );
  }

  isPointInViewport(point: LogicalPoint, padding: number = 0): boolean {
    return (
      point.x >= this.logicalPanOffset.x - padding &&
      point.x <= this.logicalPanOffset.x + this.logicalWidth + padding &&
      point.y >= this.logicalPanOffset.y - padding &&
      point.y <= this.logicalPanOffset.y + this.logicalHeight + padding
    );
  }

  convertToLogicalPoint(point: CanvasPoint): LogicalPoint {
    return new LogicalPoint(
      point.x * this.zoomLevel + this.logicalPanOffset.x,
      point.y * this.zoomLevel + this.logicalPanOffset.y
    );
  }

  convertToCanvasPoint(point: LogicalPoint): CanvasPoint {
    return new CanvasPoint(
      (point.x - this.logicalPanOffset.x) / this.zoomLevel,
      (point.y - this.logicalPanOffset.y) / this.zoomLevel
    );
  }
}

export interface CanvasUISlice {
  selectionBox: SelectionBoxState;
  setSelectionBox: (selectionBox: SelectionBoxState) => void;
  updateSelectionBox: (updates: Partial<SelectionBoxState>) => void;
  hoveredConnection: Connection | null;
  setHoveredConnection: (hoveredConnection: Connection | null) => void;
  setError: (error: string | null) => void;
  error: string | null;
  setZoomLevel: (zoomLevel: number) => void;
  panOffset: LogicalPoint;
  setPanOffset: (offset: LogicalPoint) => void;
  updatePanOffset: (deltaX: number, deltaY: number) => void;

  viewport: Viewport;
  droppedLegoBoundingBox: BoundingBox | null;
  tensorNetworkBoundingBox: BoundingBox | null;

  // Canvas panel dimensions tracking
  setCanvasPanelDimensions: (width: number, height: number) => void;

  // Viewport management
  setZoomToMouse: (newZoomLevel: number, mouseCanvasPos: CanvasPoint) => void;

  // Bounding box calculations
  calculateDroppedLegoBoundingBox: () => BoundingBox | null;
  calculateTensorNetworkBoundingBox: () => BoundingBox | null;
}

export const createCanvasUISlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  CanvasUISlice
> = (set, get) => ({
  // Legacy props
  selectionBox: {
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    justFinished: false
  },
  setSelectionBox: (selectionBox) =>
    set((state) => {
      state.selectionBox = selectionBox;
    }),
  updateSelectionBox: (updates) =>
    set((state) => {
      state.selectionBox = { ...state.selectionBox, ...updates };
    }),
  hoveredConnection: null,
  setHoveredConnection: (hoveredConnection) => {
    set((state) => {
      state.hoveredConnection = hoveredConnection;
    });
  },
  error: null,
  setError: (error) => {
    set((state) => {
      state.error = error;
    });
  },
  zoomLevel: 1,
  setZoomLevel: (zoomLevel) => {
    const clampedZoom = Math.max(0.04, Math.min(9, zoomLevel));
    set((state) => {
      state.viewport = state.viewport.with({
        zoomLevel: clampedZoom
      });
    });
  },
  panOffset: new LogicalPoint(0, 0),
  setPanOffset: (offset) => {
    set((state) => {
      state.panOffset = offset;
      state.viewport = state.viewport.with({
        logicalPanOffset: offset
      });
    });
    console.log("setPanOffset", offset);
  },
  updatePanOffset: (deltaX, deltaY) => {
    set((state) => {
      state.panOffset = state.panOffset.plus(new LogicalPoint(deltaX, deltaY));
      state.viewport = state.viewport.with({
        logicalPanOffset: state.panOffset
      });
    });
  },

  // New viewport and coordinate system
  viewport: new Viewport(800, 600, 1, new LogicalPoint(0, 0)),

  droppedLegoBoundingBox: null,
  tensorNetworkBoundingBox: null,
  visibleLegos: [],

  setCanvasPanelDimensions: (width, height) => {
    set((state) => {
      state.viewport = state.viewport.with({
        screenWidth: width,
        screenHeight: height
      });
    });
  },

  setZoomToMouse: (newZoomLevel, mouseLogicalPosition: LogicalPoint) => {
    const viewport = get().viewport;

    // Safety checks for input values
    if (!isFinite(newZoomLevel) || newZoomLevel <= 0) {
      console.warn("Invalid zoom level in setZoomToMouse:", newZoomLevel);
      return;
    }

    if (
      !isFinite(mouseLogicalPosition.x) ||
      !isFinite(mouseLogicalPosition.y)
    ) {
      console.warn(
        "Invalid mouse position in setZoomToMouse:",
        mouseLogicalPosition
      );
      return;
    }

    const clampedZoom = Math.max(0.04, Math.min(9, newZoomLevel));

    // Calculate zoom factor
    const zoomFactor = clampedZoom / viewport.zoomLevel;

    // Safety check for zoom factor
    if (!isFinite(zoomFactor) || zoomFactor <= 0) {
      console.warn("Invalid zoom factor in setZoomToMouse:", {
        clampedZoom,
        currentZoom: viewport.zoomLevel,
        zoomFactor
      });
      return;
    }

    const viewPortLogicalCenter = viewport.logicalCenter;

    // Calculate the mouse position relative to canvas center
    const mouseOffsetFromCenter = mouseLogicalPosition.minus(
      viewPortLogicalCenter
    );

    // Calculate the change in screen position due to zoom change
    const zoomDelta = mouseOffsetFromCenter.factor(1 / zoomFactor);

    // Adjust pan offset to compensate for the zoom delta
    const newPanOffset = viewport.logicalPanOffset.plus(zoomDelta);

    // Safety check for the new pan offset
    if (!isFinite(newPanOffset.x) || !isFinite(newPanOffset.y)) {
      console.warn("Invalid pan offset calculated in setZoomToMouse:", {
        newPanOffset,
        mouseOffsetFromCenter,
        zoomDelta,
        mouseCanvasPos: mouseLogicalPosition,
        clampedZoom,
        viewport
      });
      return;
    }

    set((state) => {
      state.viewport = state.viewport.with({
        zoomLevel: clampedZoom,
        logicalPanOffset: newPanOffset
      });
    });
  },

  calculateDroppedLegoBoundingBox: () => {
    const { droppedLegos } = get();

    if (droppedLegos.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    droppedLegos.forEach((lego) => {
      const size = lego.style?.size || 40;
      const halfSize = size / 2;

      minX = Math.min(minX, lego.logicalPosition.x - halfSize);
      minY = Math.min(minY, lego.logicalPosition.y - halfSize);
      maxX = Math.max(maxX, lego.logicalPosition.x + halfSize);
      maxY = Math.max(maxY, lego.logicalPosition.y + halfSize);
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  },

  calculateTensorNetworkBoundingBox: () => {
    const { tensorNetwork } = get();

    if (!tensorNetwork || tensorNetwork.legos.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    tensorNetwork.legos.forEach((lego) => {
      const size = lego.style?.size || 40;
      const halfSize = size / 2;

      minX = Math.min(minX, lego.logicalPosition.x - halfSize);
      minY = Math.min(minY, lego.logicalPosition.y - halfSize);
      maxX = Math.max(maxX, lego.logicalPosition.x + halfSize);
      maxY = Math.max(maxY, lego.logicalPosition.y + halfSize);
    });

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
});
