import React, { useMemo, useRef } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { useShallow } from "zustand/react/shallow";
import { DraggingStage } from "../../stores/legoDragState";
import { useVisibleLegoIds } from "../../hooks/useVisibleLegos";
import { ResizeHandleType, BoundingBox } from "../../stores/canvasUISlice";
import { WindowPoint } from "../../types/coordinates";

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

export const LegosLayer: React.FC = () => {
  // Use the new coordinate system with virtualization
  const visibleLegoIds = useVisibleLegoIds();
  const viewport = useCanvasStore((state) => state.viewport);
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const calculateTensorNetworkBoundingBox = useCanvasStore(
    (state) => state.calculateTensorNetworkBoundingBox
  );
  const tnBoundingBoxLogical =
    tensorNetwork && tensorNetwork.legos.length > 0
      ? calculateTensorNetworkBoundingBox()
      : null;
  const tnBoundingBox = tnBoundingBoxLogical
    ? viewport.fromLogicalToCanvasBB(tnBoundingBoxLogical)
    : null;
  // Get drag state to hide dragged legos (proxy will show instead)
  const { dragState } = useCanvasStore(
    useShallow((state) => ({
      dragState: state.legoDragState
    }))
  );

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

  // Check which legos are being dragged to hide them
  const isDraggedLego = useMemo(() => {
    const draggedIds = new Set<string>();

    // Add individually dragged lego
    if (dragState?.draggingStage === DraggingStage.DRAGGING) {
      draggedIds.add(dragState.draggedLegoInstanceId);
    }

    // Add group dragged legos (selected legos)
    if (
      tensorNetwork?.legos &&
      dragState?.draggingStage === DraggingStage.DRAGGING
    ) {
      tensorNetwork.legos.forEach((lego) => {
        draggedIds.add(lego.instance_id);
      });
    }

    return (legoId: string) => draggedIds.has(legoId);
  }, [dragState?.draggingStage === DraggingStage.DRAGGING]);

  const renderedLegos = useMemo(() => {
    return visibleLegoIds
      .filter((legoInstanceId) => !isDraggedLego(legoInstanceId)) // Hide dragged legos
      .map((legoInstanceId) => (
        <DroppedLegoDisplay
          key={legoInstanceId}
          legoInstanceId={legoInstanceId}
          demoMode={false}
        />
      ));
  }, [visibleLegoIds, isDraggedLego, viewport]);

  return (
    <>
      {tensorNetwork && tnBoundingBox && (
        <g>
          <rect
            x={tnBoundingBox.minX}
            y={tnBoundingBox.minY}
            width={tnBoundingBox.width}
            height={tnBoundingBox.height}
            fill="none"
            strokeWidth="2"
            stroke="blue"
          />

          {/* Resize handles */}
          <ResizeHandles
            boundingBox={tnBoundingBox}
            onHandleMouseDown={handleResizeMouseDown}
          />
        </g>
      )}

      {renderedLegos}
    </>
  );
};

LegosLayer.displayName = "LegosLayer";
