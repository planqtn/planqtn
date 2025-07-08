import React, { useRef, useEffect, useState, useMemo } from "react";
import { getLegoStyle } from "./LegoStyles";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { DraggingStage } from "../../stores/legoDragState";
import { useBuildingBlockDragStateStore } from "../../stores/buildingBlockDragStateStore";
import { getSmartLegoSize } from "../../utils/coordinateTransforms";
import { LogicalPoint, WindowPoint } from "../../types/coordinates.ts";
import { useDebugStore } from "../../stores/debugStore.ts";

// Separate handler for single lego drags
const SingleLegoDragProxy: React.FC<{
  mousePos: WindowPoint;
  canvasRect: DOMRect | null;
}> = ({ mousePos, canvasRect }) => {
  const legoDragState = useCanvasStore((state) => state.legoDragState);
  const viewport = useCanvasStore((state) => state.viewport);
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const zoomLevel = viewport.zoomLevel;

  // Memoize the dragged lego to prevent stale references
  const draggedLego = useMemo(() => {
    if (!legoDragState || legoDragState.draggedLegoInstanceId === "")
      return null;
    return droppedLegos.find(
      (lego) => lego.instanceId === legoDragState.draggedLegoInstanceId
    );
  }, [droppedLegos, legoDragState]);

  if (
    !legoDragState ||
    legoDragState.draggingStage !== DraggingStage.DRAGGING
  ) {
    return null;
  }

  if (!draggedLego || !canvasRect) return null;

  // Apply zoom transformation to get screen position using new coordinate system
  const proxyCanvasPos = viewport.fromWindowToCanvas(mousePos);

  // Use smart sizing for consistency
  const originalSize = draggedLego.style!.size;
  const smartSize = getSmartLegoSize(originalSize, zoomLevel);

  return (
    <div
      key={`single-drag-proxy-${draggedLego.instanceId}`}
      style={{
        position: "absolute",
        left: `${proxyCanvasPos.x - smartSize / 2}px`,
        top: `${proxyCanvasPos.y - smartSize / 2}px`,
        width: `${smartSize}px`,
        height: `${smartSize}px`,
        opacity: 0.7,
        transform: "scale(1.1)",
        filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
        transition: "none",
        pointerEvents: "none",
        zIndex: 1000
      }}
    >
      <svg width={smartSize} height={smartSize} style={{ overflow: "visible" }}>
        {draggedLego.style!.borderRadius === "full" ? (
          <circle
            cx={smartSize / 2}
            cy={smartSize / 2}
            r={smartSize / 2}
            fill={draggedLego.style!.getBackgroundColorForSvg()}
            stroke={draggedLego.style!.getBorderColorForSvg()}
            strokeWidth="2"
          />
        ) : (
          <rect
            x="2"
            y="2"
            width={smartSize - 4}
            height={smartSize - 4}
            rx={
              typeof draggedLego.style!.borderRadius === "number"
                ? draggedLego.style!.borderRadius
                : 0
            }
            fill={draggedLego.style!.getBackgroundColorForSvg()}
            stroke={draggedLego.style!.getBorderColorForSvg()}
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  );
};

// Separate handler for group drags
const GroupDragProxy: React.FC<{
  mousePos: WindowPoint;
  canvasRect: DOMRect | null;
}> = ({ mousePos, canvasRect }) => {
  const legoDragState = useCanvasStore((state) => state.legoDragState);
  const groupDragState = useCanvasStore((state) => state.groupDragState);
  const viewport = useCanvasStore((state) => state.viewport);
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);

  const zoomLevel = viewport.zoomLevel;

  // Memoize dragged legos to prevent stale references
  const draggedLegos = useMemo(() => {
    if (!groupDragState) return [];
    return droppedLegos.filter((lego) =>
      groupDragState.legoInstanceIds.includes(lego.instanceId)
    );
  }, [droppedLegos, groupDragState]);

  if (
    !groupDragState ||
    !legoDragState ||
    legoDragState.draggingStage !== DraggingStage.DRAGGING ||
    !canvasRect
  ) {
    return null;
  }

  if (draggedLegos.length === 0) return null;

  const startMouseLogicalPoint = viewport.fromWindowToLogical(
    legoDragState.startMouseWindowPoint
  );
  const currentMouseLogicalPoint = viewport.fromWindowToLogical(mousePos);

  const deltaLogical = currentMouseLogicalPoint.minus(startMouseLogicalPoint);

  return (
    <>
      {draggedLegos.map((lego: DroppedLego) => {
        const originalPos = groupDragState.originalPositions[lego.instanceId];
        if (!originalPos) return null; // Safety check for stale state

        // Calculate base proxy position in canvas coordinates
        const baseProxy = originalPos.plus(deltaLogical);

        // Apply zoom transformation to get screen position using new coordinate system
        const proxyCanvasPos = viewport.fromLogicalToCanvas(baseProxy);

        // Use smart sizing for consistency
        const originalSize = lego.style!.size;
        const smartSize = getSmartLegoSize(originalSize, zoomLevel);

        return (
          <div
            key={`group-drag-proxy-${lego.instanceId}`}
            style={{
              position: "absolute",
              left: `${proxyCanvasPos.x - smartSize / 2}px`,
              top: `${proxyCanvasPos.y - smartSize / 2}px`,
              width: `${smartSize}px`,
              height: `${smartSize}px`,
              opacity: 0.7,
              transform: "scale(1.1)",
              filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
              transition: "none",
              pointerEvents: "none",
              zIndex: 1000
            }}
          >
            <svg
              width={smartSize}
              height={smartSize}
              style={{ overflow: "visible" }}
            >
              {lego.style!.borderRadius === "full" ? (
                <circle
                  cx={smartSize / 2}
                  cy={smartSize / 2}
                  r={smartSize / 2}
                  fill={lego.style!.getBackgroundColorForSvg()}
                  stroke={lego.style!.getBorderColorForSvg()}
                  strokeWidth="2"
                />
              ) : (
                <rect
                  x="2"
                  y="2"
                  width={smartSize - 4}
                  height={smartSize - 4}
                  rx={
                    typeof lego.style!.borderRadius === "number"
                      ? lego.style!.borderRadius
                      : 0
                  }
                  fill={lego.style!.getBackgroundColorForSvg()}
                  stroke={lego.style!.getBorderColorForSvg()}
                  strokeWidth="2"
                />
              )}
            </svg>
          </div>
        );
      })}
    </>
  );
};

// Separate handler for building block drags
const BuildingBlockDragProxy: React.FC<{
  canvasRef: React.RefObject<HTMLDivElement | null> | null;
}> = ({ canvasRef }) => {
  const buildingBlockDragState = useBuildingBlockDragStateStore(
    (state) => state.buildingBlockDragState
  );
  const viewport = useCanvasStore((state) => state.viewport);
  const zoomLevel = viewport.zoomLevel;

  if (
    !buildingBlockDragState.isDragging ||
    !buildingBlockDragState.draggedLego ||
    !canvasRef?.current
  ) {
    return null;
  }

  const canvasRect = canvasRef.current.getBoundingClientRect();
  // Use mouse position from buildingBlockDragState (updated by dragover events)
  const isMouseOverCanvas =
    buildingBlockDragState.mouseX >= canvasRect.left &&
    buildingBlockDragState.mouseX <= canvasRect.right &&
    buildingBlockDragState.mouseY >= canvasRect.top &&
    buildingBlockDragState.mouseY <= canvasRect.bottom;

  if (!isMouseOverCanvas) return null;

  const lego = buildingBlockDragState.draggedLego;
  const numLegs = lego.parity_check_matrix[0].length / 2;

  const style = getLegoStyle(
    lego.type_id,
    numLegs,
    new DroppedLego(lego, new LogicalPoint(0, 0), "dummy")
  );

  // Use smart sizing for building block drag proxy
  const smartSize = getSmartLegoSize(style.size, zoomLevel);

  // Convert global mouse coordinates to canvas-relative coordinates (use buildingBlockDragState)
  const canvasX = buildingBlockDragState.mouseX - canvasRect.left;
  const canvasY = buildingBlockDragState.mouseY - canvasRect.top;

  return (
    <div
      style={{
        position: "absolute",
        left: `${canvasX - smartSize / 2}px`,
        top: `${canvasY - smartSize / 2}px`,
        width: `${smartSize}px`,
        height: `${smartSize}px`,
        opacity: 0.7,
        transform: "scale(1.1)",
        filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
        transition: "none",
        pointerEvents: "none",
        zIndex: 1000
      }}
    >
      <svg width={smartSize} height={smartSize} style={{ overflow: "visible" }}>
        {style.borderRadius === "full" ? (
          <circle
            cx={smartSize / 2}
            cy={smartSize / 2}
            r={smartSize / 2}
            fill={style.getBackgroundColorForSvg()}
            stroke={style.getBorderColorForSvg()}
            strokeWidth="2"
          />
        ) : (
          <rect
            x="2"
            y="2"
            width={smartSize - 4}
            height={smartSize - 4}
            rx={typeof style.borderRadius === "number" ? style.borderRadius : 0}
            fill={style.getBackgroundColorForSvg()}
            stroke={style.getBorderColorForSvg()}
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  );
};

// Shared hook for mouse tracking with debug integration
const useMouseTracking = (shouldTrack: boolean = true) => {
  const [mousePos, setMousePos] = useState(new WindowPoint(0, 0));
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldTrack) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        setMousePos(WindowPoint.fromMouseEvent(e));
        if (import.meta.env.VITE_ENV === "debug") {
          useDebugStore
            .getState()
            .setDebugMousePos(new WindowPoint(e.clientX, e.clientY));
        }
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [shouldTrack]);

  return mousePos;
};

export const DragProxy: React.FC = () => {
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const dragStateStage = useCanvasStore(
    (state) => state.legoDragState?.draggingStage
  );
  const groupDragState = useCanvasStore((state) => state.groupDragState);
  const buildingBlockDragState = useBuildingBlockDragStateStore(
    (state) => state.buildingBlockDragState
  );

  // Use shared mouse tracking - track when canvas lego or group dragging is happening
  // Building block dragging uses its own mouse tracking via dragover events
  const shouldTrackMouse =
    dragStateStage === DraggingStage.MAYBE_DRAGGING ||
    dragStateStage === DraggingStage.DRAGGING ||
    !!groupDragState;

  const mousePos = useMouseTracking(shouldTrackMouse);

  const canvasRef = useCanvasStore((state) => state.canvasRef);

  // Cache canvas rect to avoid getBoundingClientRect on every render
  useEffect(() => {
    if (canvasRef?.current) {
      const updateCanvasRect = () => {
        if (canvasRef?.current) {
          setCanvasRect(canvasRef.current.getBoundingClientRect());
        }
      };

      // Update rect initially
      updateCanvasRect();

      // Update rect on resize/scroll
      window.addEventListener("resize", updateCanvasRect);
      window.addEventListener("scroll", updateCanvasRect);

      return () => {
        window.removeEventListener("resize", updateCanvasRect);
        window.removeEventListener("scroll", updateCanvasRect);
      };
    }
  }, [canvasRef]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
        zIndex: 1000
      }}
    >
      {/* Building block drag proxy */}
      {buildingBlockDragState.isDragging && (
        <BuildingBlockDragProxy canvasRef={canvasRef} />
      )}

      {/* Group drag proxy */}
      {groupDragState && (
        <GroupDragProxy mousePos={mousePos} canvasRect={canvasRect} />
      )}

      {/* Single lego drag proxy - only show if not group dragging */}
      {!groupDragState && (
        <SingleLegoDragProxy mousePos={mousePos} canvasRect={canvasRect} />
      )}
    </div>
  );
};

DragProxy.displayName = "DragProxy";
