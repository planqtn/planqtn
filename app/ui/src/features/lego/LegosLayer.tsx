import React, { useMemo, useRef } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { useShallow } from "zustand/react/shallow";
import { DraggingStage } from "../../stores/legoDragState";
import { useVisibleLegoIds } from "../../hooks/useVisibleLegos";
import { ResizeHandleType, BoundingBox } from "../../stores/canvasUISlice";
import { WindowPoint } from "../../types/coordinates";
import { DroppedLego } from "../../stores/droppedLegoStore";

const DroppedLegoDisplay = React.lazy(() => import("./DroppedLegoDisplay"));

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

function calculateBoundingBoxForLegos(
  legos: DroppedLego[]
): BoundingBox | null {
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
}

export const LegosLayer: React.FC = () => {
  // Use the new coordinate system with virtualization
  const visibleLegoIds = useVisibleLegoIds();
  const viewport = useCanvasStore((state) => state.viewport);
  const isDraggedLego = useCanvasStore((state) => state.isDraggedLego);
  const groupDragState = useCanvasStore((state) => state.groupDragState);
  const legoDragState = useCanvasStore((state) => state.legoDragState);
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const calculateTensorNetworkBoundingBox = useCanvasStore(
    (state) => state.calculateTensorNetworkBoundingBox
  );
  const tnBoundingBoxLogical =
    tensorNetwork && tensorNetwork.legos.length > 0
      ? calculateTensorNetworkBoundingBox()
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

  const renderedLegos = useMemo(() => {
    return (
      visibleLegoIds
        // .filter((legoInstanceId) => !isDraggedLego(legoInstanceId)) // Hide dragged legos
        .map((legoInstanceId) => (
          <g
            key={legoInstanceId}
            visibility={isDraggedLego(legoInstanceId) ? "hidden" : "visible"}
          >
            <DroppedLegoDisplay
              key={legoInstanceId}
              legoInstanceId={legoInstanceId}
            />
          </g>
        ))
    );
  }, [
    visibleLegoIds,
    isDraggedLego,
    legoDragState.draggingStage === DraggingStage.DRAGGING,
    groupDragState,
    viewport
  ]);

  const resizeProxyLegos = useCanvasStore((state) => state.resizeProxyLegos);

  const proxyBoundingBoxLogical = resizeProxyLegos
    ? calculateBoundingBoxForLegos(resizeProxyLegos)
    : null;
  const boundingBoxLogical = proxyBoundingBoxLogical || tnBoundingBoxLogical;
  const boundingBox = boundingBoxLogical
    ? viewport.fromLogicalToCanvasBB(boundingBoxLogical)
    : null;

  return (
    <>
      {tensorNetwork && boundingBox && (
        <g>
          <rect
            x={boundingBox.minX}
            y={boundingBox.minY}
            width={boundingBox.width}
            height={boundingBox.height}
            fill="none"
            strokeWidth="2"
            stroke="blue"
          />

          {/* Resize handles */}
          {tensorNetwork.legos.length > 1 && (
            <ResizeHandles
              boundingBox={boundingBox}
              onHandleMouseDown={handleResizeMouseDown}
            />
          )}
        </g>
      )}

      {/* Only render real legos if not resizing */}
      {!resizeProxyLegos && renderedLegos}
    </>
  );
};

LegosLayer.displayName = "LegosLayer";
