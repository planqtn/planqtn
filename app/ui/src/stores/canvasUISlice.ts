import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { Connection } from "./connectionStore";
import { LogicalPoint, CanvasPoint, WindowPoint } from "../types/coordinates";
import { createRef, RefObject } from "react";
import { castDraft } from "immer";
import { DroppedLego } from "./droppedLegoStore";

export const calculateBoundingBoxForLegos = (
  legos: DroppedLego[]
): BoundingBox | null => {
  if (!legos || legos.length === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  legos.forEach((lego: DroppedLego) => {
    const size = lego.style?.size || 40;
    const halfSize = size / 2;
    minX = Math.min(minX, lego.logicalPosition.x - halfSize);
    minY = Math.min(minY, lego.logicalPosition.y - halfSize);
    maxX = Math.max(maxX, lego.logicalPosition.x + halfSize);
    maxY = Math.max(maxY, lego.logicalPosition.y + halfSize);
  });
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

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
      overrides.canvasRef === undefined ? this.canvasRef : overrides.canvasRef
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
  clearSelectionBox: () => void;
  hoveredConnection: Connection | null;
  setHoveredConnection: (hoveredConnection: Connection | null) => void;
  setError: (error: string | null) => void;
  error: string | null;
  setZoomLevel: (zoomLevel: number) => void;
  setPanOffset: (offset: LogicalPoint) => void;
  updatePanOffset: (delta: LogicalPoint) => void;
  canvasRef: RefObject<HTMLDivElement> | null;
  setCanvasRef: (element: HTMLDivElement | null) => void;
  focusOnTensorNetwork: () => void;

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
  clearSelectionBox: () => {
    set({
      selectionBox: {
        isSelecting: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        justFinished: false
      }
    });
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

    const mouseWindowPosition =
      viewport.fromLogicalToWindow(mouseLogicalPosition);

    // mouseLogicalPosition should stay the same, thus we need to calculate the new pan offset
    // base on a viewport with the new zoom level
    const newViewport = viewport.with({
      zoomLevel: clampedZoom
    });
    const newMouseLogicalPosition =
      newViewport.fromWindowToLogical(mouseWindowPosition);
    const newPanOffset = mouseLogicalPosition.minus(newMouseLogicalPosition);

    // Safety check for the new pan offset
    if (!isFinite(newPanOffset.x) || !isFinite(newPanOffset.y)) {
      console.warn("Invalid pan offset calculated in setZoomToMouse:", {
        newPanOffset,
        mouseWindowPosition,
        clampedZoom,
        viewport
      });
      return;
    }

    set((state) => {
      state.viewport = castDraft(
        state.viewport.with({
          zoomLevel: clampedZoom,
          logicalPanOffset: newPanOffset.plus(viewport.logicalPanOffset)
        })
      );
    });
  },

  focusOnTensorNetwork: () => {
    set((state) => {
      const tensorNetworkBoundingBox =
        get().calculateTensorNetworkBoundingBox();
      if (!tensorNetworkBoundingBox) return;

      // if tensornetrowk bounding box is within the viewport, do nothing
      if (
        state.viewport.isPointInViewport(
          new LogicalPoint(
            tensorNetworkBoundingBox.minX,
            tensorNetworkBoundingBox.minY
          ),
          0
        ) &&
        state.viewport.isPointInViewport(
          new LogicalPoint(
            tensorNetworkBoundingBox.maxX,
            tensorNetworkBoundingBox.maxY
          ),
          0
        )
      ) {
        return;
      }

      // set the view port to be a good 200 px margin around the tensor network
      // we have to calculate a zoom level that will fit the tensor network in the viewport
      // and then the pan so that the center of the tensor network is in the center of the viewport

      const tensorNetworkWidth =
        tensorNetworkBoundingBox.maxX - tensorNetworkBoundingBox.minX;
      const tensorNetworkHeight =
        tensorNetworkBoundingBox.maxY - tensorNetworkBoundingBox.minY;
      const margin = 200;

      const newZoomLevel = Math.min(
        state.viewport.screenWidth / (tensorNetworkWidth + margin * 2),
        state.viewport.screenHeight / (tensorNetworkHeight + margin * 2)
      );

      const newViewport = state.viewport.with({
        logicalPanOffset: new LogicalPoint(0, 0),
        zoomLevel: newZoomLevel
      });

      const newPanOffset = new LogicalPoint(
        (tensorNetworkBoundingBox.minX + tensorNetworkBoundingBox.maxX) / 2 -
          newViewport.logicalWidth / 2,
        (tensorNetworkBoundingBox.minY + tensorNetworkBoundingBox.maxY) / 2 -
          newViewport.logicalHeight / 2
      );

      state.viewport = castDraft(
        newViewport.with({
          logicalPanOffset: newPanOffset
        })
      );
    });
  },

  calculateDroppedLegoBoundingBox: () => {
    const { droppedLegos } = get();

    if (droppedLegos.length === 0) return null;
    return calculateBoundingBoxForLegos(droppedLegos);
  },

  calculateTensorNetworkBoundingBox: () => {
    const { tensorNetwork } = get();

    if (!tensorNetwork || tensorNetwork.legos.length === 0) return null;

    return calculateBoundingBoxForLegos(tensorNetwork.legos);
  },

  /**
   * Handle mouse wheel events with zoom-to-mouse functionality
   */
  handleWheelEvent: (e: WheelEvent): void => {
    // Only handle zoom if Ctrl/Cmd key is pressed
    if (!(e.ctrlKey || e.metaKey)) return;

    e.preventDefault();

    // Calculate new zoom level
    const zoomDelta = 1 + 0.0002 * e.deltaY;
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
      // Calculate which coordinates need to be preserved based on handleType
      const { handleType } = resizeState;
      let preservedCoordinates = {
        minX: false,
        minY: false,
        maxX: false,
        maxY: false
      };

      switch (handleType) {
        case ResizeHandleType.TOP_LEFT:
          preservedCoordinates = {
            minX: false,
            minY: false,
            maxX: true,
            maxY: true
          };
          break;
        case ResizeHandleType.TOP:
          preservedCoordinates = {
            minX: true,
            minY: false,
            maxX: true,
            maxY: true
          };
          break;
        case ResizeHandleType.TOP_RIGHT:
          preservedCoordinates = {
            minX: true,
            minY: false,
            maxX: false,
            maxY: true
          };
          break;
        case ResizeHandleType.RIGHT:
          preservedCoordinates = {
            minX: true,
            minY: true,
            maxX: false,
            maxY: true
          };
          break;
        case ResizeHandleType.BOTTOM_RIGHT:
          preservedCoordinates = {
            minX: true,
            minY: true,
            maxX: false,
            maxY: false
          };
          break;
        case ResizeHandleType.BOTTOM:
          preservedCoordinates = {
            minX: true,
            minY: true,
            maxX: true,
            maxY: false
          };
          break;
        case ResizeHandleType.BOTTOM_LEFT:
          preservedCoordinates = {
            minX: false,
            minY: true,
            maxX: true,
            maxY: false
          };
          break;
        case ResizeHandleType.LEFT:
          preservedCoordinates = {
            minX: false,
            minY: true,
            maxX: true,
            maxY: true
          };
          break;
      }

      // Find legos that define the bounding box coordinates BEFORE resizing
      const minXLegos = tensorNetwork.legos.filter((lego) => {
        const size = lego.style?.size || 40;
        const halfSize = size / 2;
        return (
          Math.abs(
            lego.logicalPosition.x - halfSize - currentBoundingBox.minX
          ) < 0.001
        );
      });
      const minYLegos = tensorNetwork.legos.filter((lego) => {
        const size = lego.style?.size || 40;
        const halfSize = size / 2;
        return (
          Math.abs(
            lego.logicalPosition.y - halfSize - currentBoundingBox.minY
          ) < 0.001
        );
      });
      const maxXLegos = tensorNetwork.legos.filter((lego) => {
        const size = lego.style?.size || 40;
        const halfSize = size / 2;
        return (
          Math.abs(
            lego.logicalPosition.x + halfSize - currentBoundingBox.maxX
          ) < 0.001
        );
      });
      const maxYLegos = tensorNetwork.legos.filter((lego) => {
        const size = lego.style?.size || 40;
        const halfSize = size / 2;
        return (
          Math.abs(
            lego.logicalPosition.y + halfSize - currentBoundingBox.maxY
          ) < 0.001
        );
      });

      // Apply resizing logic, but preserve specific coordinates for coordinate-defining legos
      const proxyLegos = tensorNetwork.legos.map((lego) => {
        // Check if this lego defines a preserved coordinate
        const isMinXDefiner = minXLegos.includes(lego);
        const isMinYDefiner = minYLegos.includes(lego);
        const isMaxXDefiner = maxXLegos.includes(lego);
        const isMaxYDefiner = maxYLegos.includes(lego);

        // Calculate the new position using relative scaling
        const relativeX =
          (lego.logicalPosition.x - currentBoundingBox.minX) /
          currentBoundingBox.width;
        const relativeY =
          (lego.logicalPosition.y - currentBoundingBox.minY) /
          currentBoundingBox.height;
        const newX = newBoundingBox.minX + relativeX * newBoundingBox.width;
        const newY = newBoundingBox.minY + relativeY * newBoundingBox.height;

        // Preserve specific coordinates based on which coordinates this lego defines
        let finalX = newX;
        let finalY = newY;

        // If this lego defines a preserved X coordinate, keep its original X
        if (
          (preservedCoordinates.minX && isMinXDefiner) ||
          (preservedCoordinates.maxX && isMaxXDefiner)
        ) {
          finalX = lego.logicalPosition.x;
        }

        // If this lego defines a preserved Y coordinate, keep its original Y
        if (
          (preservedCoordinates.minY && isMinYDefiner) ||
          (preservedCoordinates.maxY && isMaxYDefiner)
        ) {
          finalY = lego.logicalPosition.y;
        }

        return lego.with({ logicalPosition: new LogicalPoint(finalX, finalY) });
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

    console.log("newBoundingBox", newBoundingBox);

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
