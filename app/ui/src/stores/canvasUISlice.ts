import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { Connection } from "./connectionStore";
import { LogicalPoint, CanvasPoint, WindowPoint } from "../types/coordinates";
import { createRef, RefObject } from "react";
import { castDraft } from "immer";
import { DroppedLego } from "./droppedLegoStore";

export interface SelectionBoxState {
  isSelecting: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  justFinished: boolean;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ResizeState {
  isResizing: boolean;
  handleType: ResizeHandleType | null;
  startBoundingBox: BoundingBox | null;
  startMousePosition: LogicalPoint | null;
  currentMousePosition: LogicalPoint | null;
}

export enum ResizeHandleType {
  TOP_LEFT = "top-left",
  TOP = "top",
  TOP_RIGHT = "top-right",
  RIGHT = "right",
  BOTTOM_RIGHT = "bottom-right",
  BOTTOM = "bottom",
  BOTTOM_LEFT = "bottom-left",
  LEFT = "left"
}

export class Viewport {
  constructor(
    // Screen-space viewport (physical pixels)
    public screenWidth: number,
    public screenHeight: number,

    // Zoom and pan state
    public zoomLevel: number,
    public logicalPanOffset: LogicalPoint,

    // Canvas ref
    public canvasRef: RefObject<HTMLDivElement> | null
  ) {}

  public get logicalWidth(): number {
    return this.screenWidth / this.zoomLevel;
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
      overrides.logicalPanOffset || this.logicalPanOffset,
      overrides.canvasRef || this.canvasRef
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

  fromCanvasToLogical(point: CanvasPoint): LogicalPoint {
    return new LogicalPoint(
      point.x / this.zoomLevel + this.logicalPanOffset.x,
      point.y / this.zoomLevel + this.logicalPanOffset.y
    );
  }

  fromLogicalToCanvas(point: LogicalPoint): CanvasPoint {
    return new CanvasPoint(
      (point.x - this.logicalPanOffset.x) * this.zoomLevel,
      (point.y - this.logicalPanOffset.y) * this.zoomLevel
    );
  }

  fromLogicalToWindow(point: LogicalPoint): WindowPoint {
    const canvasPoint = this.fromLogicalToCanvas(point);
    return new WindowPoint(
      canvasPoint.x +
        (this.canvasRef?.current?.getBoundingClientRect().left ?? 0),
      canvasPoint.y +
        (this.canvasRef?.current?.getBoundingClientRect().top ?? 0)
    );
  }

  fromWindowToCanvas(point: WindowPoint): CanvasPoint {
    return new CanvasPoint(
      point.x - (this.canvasRef?.current?.getBoundingClientRect().left ?? 0),
      point.y - (this.canvasRef?.current?.getBoundingClientRect().top ?? 0)
    );
  }

  fromWindowToLogical(point: WindowPoint): LogicalPoint {
    return this.fromCanvasToLogical(this.fromWindowToCanvas(point));
  }

  fromLogicalToCanvasBB(rect: BoundingBox): BoundingBox {
    const canvasMin = this.fromLogicalToCanvas(
      new LogicalPoint(rect.minX, rect.minY)
    );
    const canvasMax = this.fromLogicalToCanvas(
      new LogicalPoint(rect.maxX, rect.maxY)
    );
    return {
      minX: canvasMin.x,
      minY: canvasMin.y,
      maxX: canvasMax.x,
      maxY: canvasMax.y,
      width: canvasMax.x - canvasMin.x,
      height: canvasMax.y - canvasMin.y
    };
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
  setPanOffset: (offset: LogicalPoint) => void;
  updatePanOffset: (delta: LogicalPoint) => void;
  canvasRef: RefObject<HTMLDivElement> | null;
  setCanvasRef: (element: HTMLDivElement | null) => void;

  viewport: Viewport;

  // Canvas panel dimensions tracking
  setCanvasPanelDimensions: (width: number, height: number) => void;

  // Viewport management
  setZoomToMouse: (
    newZoomLevel: number,
    mouseLogicalPosition: LogicalPoint
  ) => void;

  // Bounding box calculations
  calculateDroppedLegoBoundingBox: () => BoundingBox | null;
  calculateTensorNetworkBoundingBox: () => BoundingBox | null;

  // Mouse wheel handling
  handleWheelEvent: (e: WheelEvent) => void;

  // Resize functionality
  resizeState: ResizeState;
  setResizeState: (resizeState: ResizeState) => void;
  updateResizeState: (updates: Partial<ResizeState>) => void;
  startResize: (
    handleType: ResizeHandleType,
    mousePosition: LogicalPoint
  ) => void;
  updateResize: (mousePosition: LogicalPoint) => void;
  endResize: () => void;
  calculateNewBoundingBox: (
    startBoundingBox: BoundingBox,
    startMousePosition: LogicalPoint,
    currentMousePosition: LogicalPoint,
    handleType: ResizeHandleType
  ) => BoundingBox | null;
  resizeProxyLegos: DroppedLego[] | null;
  setResizeProxyLegos: (legos: DroppedLego[] | null) => void;
  suppressNextCanvasClick: boolean;
  setSuppressNextCanvasClick: (val: boolean) => void;
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
      state.viewport = castDraft(
        state.viewport.with({
          zoomLevel: clampedZoom
        })
      );
    });
  },
  panOffset: new LogicalPoint(0, 0),
  setPanOffset: (offset) => {
    set((state) => {
      state.viewport = castDraft(
        state.viewport.with({
          logicalPanOffset: offset
        })
      );
    });
  },
  updatePanOffset: (delta) => {
    set((state) => {
      state.viewport = castDraft(
        state.viewport.with({
          logicalPanOffset: state.viewport.logicalPanOffset.plus(delta)
        })
      );
    });
  },

  // New viewport and coordinate system
  viewport: new Viewport(800, 600, 1, new LogicalPoint(0, 0), null),

  visibleLegos: [],

  setCanvasPanelDimensions: (width, height) => {
    set((state) => {
      state.viewport = castDraft(
        state.viewport.with({
          screenWidth: width,
          screenHeight: height
        })
      );
    });
  },

  canvasRef: null,
  setCanvasRef: (element: HTMLDivElement | null) => {
    if (!element) {
      return;
    }
    const newRef = createRef() as RefObject<HTMLDivElement>;
    newRef.current = element;
    set({
      canvasRef: newRef,
      viewport: get().viewport.with({ canvasRef: newRef })
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

    // Calculate the mouse position relative to the origin, which is the top left corner of the viewport
    const mouseOffsetFromOrigin = mouseLogicalPosition
      .minus(viewport.logicalPanOffset)
      .factor(-1);

    // Calculate the change in screen position due to zoom change
    const zoomDelta = mouseOffsetFromOrigin.factor(1 - zoomFactor);

    // Adjust pan offset to compensate for the zoom delta
    const newPanOffset = viewport.logicalPanOffset.plus(zoomDelta);

    // Safety check for the new pan offset
    if (!isFinite(newPanOffset.x) || !isFinite(newPanOffset.y)) {
      console.warn("Invalid pan offset calculated in setZoomToMouse:", {
        newPanOffset,
        mouseOffsetFromCenter: mouseOffsetFromOrigin,
        zoomDelta,
        mouseCanvasPos: mouseLogicalPosition,
        clampedZoom,
        viewport
      });
      return;
    }

    set((state) => {
      state.viewport = castDraft(
        state.viewport.with({
          zoomLevel: clampedZoom,
          logicalPanOffset: newPanOffset
        })
      );
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
    const padding = 2;

    if (!tensorNetwork || tensorNetwork.legos.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    tensorNetwork.legos.forEach((lego) => {
      const size = lego.style?.size || 40;
      const halfSize = size / 2;

      minX = Math.min(minX, lego.logicalPosition.x - halfSize - padding);
      minY = Math.min(minY, lego.logicalPosition.y - halfSize - padding);
      maxX = Math.max(maxX, lego.logicalPosition.x + halfSize + padding);
      maxY = Math.max(maxY, lego.logicalPosition.y + halfSize + padding);
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

  /**
   * Handle mouse wheel events with zoom-to-mouse functionality
   */
  handleWheelEvent: (e: WheelEvent): void => {
    // Only handle zoom if Ctrl/Cmd key is pressed
    if (!(e.ctrlKey || e.metaKey)) return;

    e.preventDefault();

    // Calculate new zoom level
    const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoomLevel = Math.max(
      0.04,
      Math.min(9, get().viewport.zoomLevel * zoomDelta)
    );

    // Apply zoom centered on mouse position
    get().setZoomToMouse(
      newZoomLevel,
      get().viewport.fromWindowToLogical(WindowPoint.fromMouseEvent(e))
    );
  },

  // Resize functionality
  resizeState: {
    isResizing: false,
    handleType: null,
    startBoundingBox: null,
    startMousePosition: null,
    currentMousePosition: null
  },

  setResizeState: (resizeState) =>
    set((state) => {
      state.resizeState = resizeState;
    }),

  updateResizeState: (updates) =>
    set((state) => {
      state.resizeState = { ...state.resizeState, ...updates };
    }),

  startResize: (handleType: ResizeHandleType, mousePosition: LogicalPoint) => {
    const currentBoundingBox = get().calculateTensorNetworkBoundingBox();
    if (!currentBoundingBox) return;

    set((state) => {
      state.resizeState = {
        isResizing: true,
        handleType,
        startBoundingBox: currentBoundingBox,
        startMousePosition: mousePosition,
        currentMousePosition: mousePosition
      };
    });
  },

  updateResize: (mousePosition: LogicalPoint) => {
    const { resizeState } = get();
    if (
      !resizeState.isResizing ||
      !resizeState.startBoundingBox ||
      !resizeState.handleType
    )
      return;

    set((state) => {
      state.resizeState.currentMousePosition = mousePosition;
    });

    // Calculate new bounding box based on resize handle and mouse movement
    const newBoundingBox = get().calculateNewBoundingBox(
      resizeState.startBoundingBox,
      resizeState.startMousePosition!,
      mousePosition,
      resizeState.handleType
    );

    if (newBoundingBox) {
      // Instead of updating real legos, update the proxy legos
      const { tensorNetwork } = get();
      const currentBoundingBox = get().calculateTensorNetworkBoundingBox();
      if (
        !tensorNetwork ||
        tensorNetwork.legos.length === 0 ||
        !currentBoundingBox
      ) {
        set((state) => {
          state.resizeProxyLegos = null;
        });
        return;
      }
      const proxyLegos = tensorNetwork.legos.map((lego) => {
        const relativeX =
          (lego.logicalPosition.x - currentBoundingBox.minX) /
          currentBoundingBox.width;
        const relativeY =
          (lego.logicalPosition.y - currentBoundingBox.minY) /
          currentBoundingBox.height;
        const newX = newBoundingBox.minX + relativeX * newBoundingBox.width;
        const newY = newBoundingBox.minY + relativeY * newBoundingBox.height;
        return lego.with({ logicalPosition: new LogicalPoint(newX, newY) });
      });
      set((state) => {
        state.resizeProxyLegos = proxyLegos;
      });
    } else {
      set((state) => {
        state.resizeProxyLegos = null;
      });
    }
  },

  endResize: () => {
    const { resizeProxyLegos, moveDroppedLegos, tensorNetwork, addOperation } =
      get();

    if (resizeProxyLegos && tensorNetwork) {
      // Prepare operation history
      const oldLegos = tensorNetwork.legos;
      const newLegos = resizeProxyLegos;

      // Add operation history
      addOperation({
        type: "move",
        data: {
          legosToUpdate: oldLegos.map((oldLego, i) => ({
            oldLego,
            newLego: newLegos[i]
          }))
        }
      });
      moveDroppedLegos(newLegos);
    }
    set((state) => {
      state.resizeState = {
        isResizing: false,
        handleType: null,
        startBoundingBox: null,
        startMousePosition: null,
        currentMousePosition: null
      };
      state.resizeProxyLegos = null;
    });
    set({ suppressNextCanvasClick: true });
  },

  calculateNewBoundingBox: (
    startBoundingBox: BoundingBox,
    startMousePosition: LogicalPoint,
    currentMousePosition: LogicalPoint,
    handleType: ResizeHandleType
  ): BoundingBox | null => {
    const deltaX = currentMousePosition.x - startMousePosition.x;
    const deltaY = currentMousePosition.y - startMousePosition.y;

    const newBoundingBox = { ...startBoundingBox };

    switch (handleType) {
      case ResizeHandleType.TOP_LEFT:
        newBoundingBox.minX += deltaX;
        newBoundingBox.minY += deltaY;
        break;
      case ResizeHandleType.TOP:
        newBoundingBox.minY += deltaY;
        break;
      case ResizeHandleType.TOP_RIGHT:
        newBoundingBox.maxX += deltaX;
        newBoundingBox.minY += deltaY;
        break;
      case ResizeHandleType.RIGHT:
        newBoundingBox.maxX += deltaX;
        break;
      case ResizeHandleType.BOTTOM_RIGHT:
        newBoundingBox.maxX += deltaX;
        newBoundingBox.maxY += deltaY;
        break;
      case ResizeHandleType.BOTTOM:
        newBoundingBox.maxY += deltaY;
        break;
      case ResizeHandleType.BOTTOM_LEFT:
        newBoundingBox.minX += deltaX;
        newBoundingBox.maxY += deltaY;
        break;
      case ResizeHandleType.LEFT:
        newBoundingBox.minX += deltaX;
        break;
    }

    // Ensure minimum size
    const minSize = 50;
    if (newBoundingBox.width < minSize || newBoundingBox.height < minSize) {
      return null;
    }

    return {
      ...newBoundingBox,
      width: newBoundingBox.maxX - newBoundingBox.minX,
      height: newBoundingBox.maxY - newBoundingBox.minY
    };
  },
  resizeProxyLegos: null,
  setResizeProxyLegos: (legos) =>
    set((state) => {
      state.resizeProxyLegos = legos;
    }),
  suppressNextCanvasClick: false,
  setSuppressNextCanvasClick: (val) => set({ suppressNextCanvasClick: val })
});
