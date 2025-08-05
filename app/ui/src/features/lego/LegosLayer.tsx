import React, { useMemo, useRef, useEffect } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { useVisibleLegoIds } from "../../hooks/useVisibleLegos";
import { LogicalPoint } from "../../types/coordinates";
import { DroppedLegoDisplay } from "./DroppedLegoDisplay";
import { DraggingStage } from "../../stores/legoDragState";
import { useShallow } from "zustand/react/shallow";
import { ResizeHandleType, BoundingBox } from "../../stores/canvasUISlice";
import { calculateBoundingBoxForLegos } from "../../stores/canvasUISlice";
import { SubnetNameDisplay } from "./SubnetNameDisplay";
import { WindowPoint } from "../../types/coordinates";
import { usePanelConfigStore } from "@/stores/panelConfigStore";

interface ResizeHandleProps {
  x: number;
  y: number;
  handleType: ResizeHandleType;
  onMouseDown: (e: React.MouseEvent, handleType: ResizeHandleType) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({
  x,
  y,
  handleType,
  onMouseDown
}) => {
  const handleSize = 8;
  const halfSize = handleSize / 2;

  return (
    <rect
      x={x - halfSize}
      y={y - halfSize}
      width={handleSize}
      height={handleSize}
      fill="#4A90E2"
      stroke="#2E5BBA"
      strokeWidth="1"
      style={{
        cursor: getCursorForHandle(handleType),
        pointerEvents: "all"
      }}
      onMouseDown={(e) => onMouseDown(e, handleType)}
    />
  );
};

const getCursorForHandle = (handleType: ResizeHandleType): string => {
  switch (handleType) {
    case ResizeHandleType.TOP_LEFT:
    case ResizeHandleType.BOTTOM_RIGHT:
      return "nw-resize";
    case ResizeHandleType.TOP_RIGHT:
    case ResizeHandleType.BOTTOM_LEFT:
      return "ne-resize";
    case ResizeHandleType.TOP:
    case ResizeHandleType.BOTTOM:
      return "ns-resize";
    case ResizeHandleType.LEFT:
    case ResizeHandleType.RIGHT:
      return "ew-resize";
    default:
      return "pointer";
  }
};

interface ResizeHandlesProps {
  boundingBox: BoundingBox;
  onHandleMouseDown: (
    e: React.MouseEvent,
    handleType: ResizeHandleType
  ) => void;
}

const ResizeHandles: React.FC<ResizeHandlesProps> = ({
  boundingBox,
  onHandleMouseDown
}) => {
  const handlePositions = useMemo(() => {
    const { minX, minY, maxX, maxY } = boundingBox;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return [
      { x: minX, y: minY, type: ResizeHandleType.TOP_LEFT },
      { x: centerX, y: minY, type: ResizeHandleType.TOP },
      { x: maxX, y: minY, type: ResizeHandleType.TOP_RIGHT },
      { x: maxX, y: centerY, type: ResizeHandleType.RIGHT },
      { x: maxX, y: maxY, type: ResizeHandleType.BOTTOM_RIGHT },
      { x: centerX, y: maxY, type: ResizeHandleType.BOTTOM },
      { x: minX, y: maxY, type: ResizeHandleType.BOTTOM_LEFT },
      { x: minX, y: centerY, type: ResizeHandleType.LEFT }
    ];
  }, [boundingBox]);

  return (
    <>
      {handlePositions.map(({ x, y, type }) => (
        <ResizeHandle
          key={type}
          x={x}
          y={y}
          handleType={type}
          onMouseDown={onHandleMouseDown}
        />
      ))}
    </>
  );
};

export const LegosLayer: React.FC = () => {
  // Use the new coordinate system with virtualization
  const visibleLegoIds = useVisibleLegoIds();
  const viewport = useCanvasStore((state) => state.viewport);
  const isDraggedLego = useCanvasStore((state) => state.isDraggedLego);
  const groupDragState = useCanvasStore((state) => state.groupDragState);
  const legoDragState = useCanvasStore((state) => state.legoDragState);
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );
  const showToolbar = usePanelConfigStore((state) => state.showToolbar);
  const calculateTensorNetworkBoundingBox = useCanvasStore(
    (state) => state.calculateTensorNetworkBoundingBox
  );
  const tnBoundingBoxLogical =
    tensorNetwork && tensorNetwork.legos.length > 0
      ? calculateTensorNetworkBoundingBox(tensorNetwork)
      : null;

  // Resize functionality
  const { startResize, updateResize, endResize } = useCanvasStore(
    useShallow((state) => ({
      startResize: state.startResize,
      updateResize: state.updateResize,
      endResize: state.endResize
    }))
  );

  // Ref to track if we are resizing
  const isResizingRef = useRef(false);

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    handleType: ResizeHandleType
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const mouseLogicalPosition = viewport.fromWindowToLogical(
      new WindowPoint(e.clientX, e.clientY)
    );

    startResize(handleType, mouseLogicalPosition);
    isResizingRef.current = true;

    // Attach global listeners
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
  };

  // These must be defined outside to be stable references
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!isResizingRef.current) return;
    const mouseLogicalPosition = viewport.fromWindowToLogical(
      new WindowPoint(e.clientX, e.clientY)
    );
    updateResize(mouseLogicalPosition);
  };

  const handleGlobalMouseUp = () => {
    if (!isResizingRef.current) return;
    endResize();
    isResizingRef.current = false;
    window.removeEventListener("mousemove", handleGlobalMouseMove);
    window.removeEventListener("mouseup", handleGlobalMouseUp);
  };

  const resizeProxyLegos = useCanvasStore((state) => state.resizeProxyLegos);

  const renderedLegos = useMemo(() => {
    // Get the IDs of legos being resized
    const resizingLegoIds =
      resizeProxyLegos?.map((lego) => lego.instance_id) || [];

    return (
      visibleLegoIds
        // .filter((legoInstanceId) => !isDraggedLego(legoInstanceId)) // Hide dragged legos
        .map((legoInstanceId) => {
          // Hide legos that are being resized (they will be shown as proxy legos instead)
          const isBeingResized = resizingLegoIds.includes(legoInstanceId);
          const isDragged = isDraggedLego(legoInstanceId);

          return (
            <g
              key={legoInstanceId}
              visibility={isDragged || isBeingResized ? "hidden" : "visible"}
            >
              <DroppedLegoDisplay
                key={legoInstanceId}
                legoInstanceId={legoInstanceId}
              />
            </g>
          );
        })
    );
  }, [
    visibleLegoIds,
    isDraggedLego,
    legoDragState.draggingStage === DraggingStage.DRAGGING,
    groupDragState,
    viewport,
    resizeProxyLegos
  ]);

  // Get dragged legos for bounding box calculation
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);

  // Calculate bounding box for dragged legos
  const draggedLegos = useMemo(() => {
    if (legoDragState.draggingStage !== DraggingStage.DRAGGING) {
      return [];
    }

    // Get all dragged legos (both individual and group)
    const draggedIds = new Set<string>();

    // Add individually dragged lego
    if (legoDragState.draggedLegoInstanceId) {
      draggedIds.add(legoDragState.draggedLegoInstanceId);
    }

    // Add group dragged legos
    if (groupDragState && groupDragState.legoInstanceIds) {
      groupDragState.legoInstanceIds.forEach((id) => draggedIds.add(id));
    }

    return droppedLegos.filter((lego) => draggedIds.has(lego.instance_id));
  }, [groupDragState, legoDragState, droppedLegos]);

  const proxyBoundingBoxLogical = resizeProxyLegos
    ? calculateBoundingBoxForLegos(resizeProxyLegos)
    : null;

  const mousePos = useCanvasStore((state) => state.mousePos);

  // Calculate bounding box for dragged legos with their current positions
  const setDragOffset = useCanvasStore((state) => state.setDragOffset);

  const draggedLegosBoundingBoxLogical = useMemo(() => {
    if (draggedLegos.length === 0) {
      return null;
    }

    // Calculate the delta from original positions to current positions (same logic as DragProxy)
    const startMouseLogicalPoint = viewport.fromWindowToLogical(
      legoDragState.startMouseWindowPoint
    );
    const currentMouseLogicalPoint = viewport.fromWindowToLogical(mousePos);

    const deltaLogical = currentMouseLogicalPoint.minus(startMouseLogicalPoint);

    // Handle group drag (multiple legos)
    if (groupDragState && groupDragState.originalPositions) {
      // Create legos with updated positions for bounding box calculation (same as DragProxy)
      const legosWithUpdatedPositions = draggedLegos.map((lego) => {
        const originalPos = groupDragState.originalPositions[lego.instance_id];
        if (originalPos) {
          return lego.with({
            logicalPosition: originalPos.plus(deltaLogical)
          });
        }
        return lego;
      });

      return calculateBoundingBoxForLegos(legosWithUpdatedPositions);
    }

    // Handle single lego drag (same logic as SingleLegoDragProxy)
    if (legoDragState.draggedLegoInstanceId && draggedLegos.length === 1) {
      const lego = draggedLegos[0];

      // Calculate the mouse starting grab delta (same as DragProxy)
      const mouseStartingGrabDeltaWindow =
        legoDragState.startMouseWindowPoint.minus(
          viewport.fromLogicalToWindow(legoDragState.startLegoLogicalPoint)
        );

      // Calculate the new canvas position (same as DragProxy)
      const proxyCanvasPos = viewport.fromWindowToCanvas(
        mousePos.minus(mouseStartingGrabDeltaWindow)
      );

      // Convert back to logical position for bounding box calculation
      const newLogicalPos = viewport.fromCanvasToLogical(proxyCanvasPos);

      const updatedLego = lego.with({
        logicalPosition: newLogicalPos
      });

      return calculateBoundingBoxForLegos([updatedLego]);
    }

    return calculateBoundingBoxForLegos(draggedLegos);
  }, [draggedLegos, groupDragState, legoDragState, viewport, mousePos]);

  // Handle drag offset updates in a separate effect to avoid setState during render
  useEffect(() => {
    if (draggedLegos.length === 0) {
      setDragOffset(null);
      return;
    }

    const draggedLegosBoundingBox = draggedLegosBoundingBoxLogical;
    if (!draggedLegosBoundingBox) {
      setDragOffset(null);
      return;
    }

    // Calculate drag offset for floating panels
    const originalBoundingBox = calculateBoundingBoxForLegos(draggedLegos);
    if (originalBoundingBox && draggedLegosBoundingBox) {
      const originalCenter = new LogicalPoint(
        originalBoundingBox.minX + originalBoundingBox.width / 2,
        originalBoundingBox.minY + originalBoundingBox.height / 2
      );
      const newCenter = new LogicalPoint(
        draggedLegosBoundingBox.minX + draggedLegosBoundingBox.width / 2,
        draggedLegosBoundingBox.minY + draggedLegosBoundingBox.height / 2
      );
      const originalCanvasPos = viewport.fromLogicalToCanvas(originalCenter);
      const newCanvasPos = viewport.fromLogicalToCanvas(newCenter);
      const offset = {
        x: newCanvasPos.x - originalCanvasPos.x,
        y: newCanvasPos.y - originalCanvasPos.y
      };
      setDragOffset(offset);
    }
  }, [draggedLegos, draggedLegosBoundingBoxLogical, viewport, setDragOffset]);

  const boundingBoxLogical =
    proxyBoundingBoxLogical ||
    draggedLegosBoundingBoxLogical ||
    tnBoundingBoxLogical;
  const boundingBox = boundingBoxLogical
    ? viewport.fromLogicalToCanvasBB(boundingBoxLogical)
    : null;

  // Calculate constrained positions to keep name within canvas bounds
  const constrainedBoundingBox = useMemo(() => {
    if (!boundingBox) return null;

    // Get canvas dimensions
    const canvasWidth = viewport.screenWidth;
    const canvasHeight = viewport.screenHeight;

    // Name display dimensions (approximate)
    const nameHeight = 30;
    const nameWidth = 200; // Approximate width of the name

    // Name position is ALWAYS below the bounding box with fixed spacing, but constrained to canvas bounds
    const desiredNameTop = boundingBox.minY + boundingBox.height + 10; // Always 10px below bounding box
    const constrainedNameTop = Math.min(
      desiredNameTop,
      canvasHeight - nameHeight - 10
    ); // Don't go off bottom

    // Center the name on the bounding box, but constrain to canvas bounds
    const boundingBoxCenterX = boundingBox.minX + boundingBox.width / 2;
    const desiredNameLeft = boundingBoxCenterX - nameWidth / 2;
    let constrainedNameLeft = desiredNameLeft;
    if (constrainedNameLeft < 10) {
      // If too far left, align to left edge
      constrainedNameLeft = 10;
    } else if (constrainedNameLeft + nameWidth > canvasWidth - 10) {
      // If too far right, align to right edge
      constrainedNameLeft = canvasWidth - nameWidth - 10;
    }

    return {
      ...boundingBox,
      constrainedNameTop,
      constrainedNameLeft
    };
  }, [boundingBox, viewport.screenWidth, viewport.screenHeight]);

  return (
    <>
      {/* Render real legos (non-resizing ones are filtered in useMemo) */}
      {renderedLegos}
      {/* Show bounding box and subnet name for tensor network or dragged legos */}
      {constrainedBoundingBox && (
        <g>
          <rect
            x={constrainedBoundingBox.minX}
            y={constrainedBoundingBox.minY}
            width={constrainedBoundingBox.width}
            height={constrainedBoundingBox.height}
            fill="none"
            strokeWidth="2"
            stroke="blue"
          />

          {/* Resize handles - only show for tensor network with multiple legos */}
          {tensorNetwork &&
            tensorNetwork.legos.length > 1 &&
            !draggedLegos.length && (
              <ResizeHandles
                boundingBox={constrainedBoundingBox}
                onHandleMouseDown={handleResizeMouseDown}
              />
            )}
        </g>
      )}

      {/* Subnet name display */}
      {constrainedBoundingBox && showToolbar && (
        <SubnetNameDisplay
          boundingBox={constrainedBoundingBox}
          networkSignature={tensorNetwork?.signature || ""}
          networkName={
            draggedLegos.length > 0
              ? `${draggedLegos.length} legos`
              : tensorNetwork?.isSingleLego
                ? tensorNetwork.singleLego.short_name
                : cachedTensorNetworks[tensorNetwork?.signature || ""]?.name ||
                  `${tensorNetwork?.legos.length || 0} legos`
          }
          isSingleLego={tensorNetwork?.isSingleLego || false}
          singleLegoInstanceId={
            tensorNetwork?.isSingleLego
              ? tensorNetwork.singleLego.instance_id
              : undefined
          }
          constrainedNameTop={constrainedBoundingBox.constrainedNameTop}
          constrainedNameLeft={constrainedBoundingBox.constrainedNameLeft}
        />
      )}
    </>
  );
};

LegosLayer.displayName = "LegosLayer";
