import React, { useRef, useEffect, useState, useMemo } from "react";
import { getLegoStyle } from "./LegoStyles";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { DraggingStage } from "../../stores/legoDragState";
import { useBuildingBlockDragStateStore } from "../../stores/buildingBlockDragStateStore";
import { getSmartLegoSize } from "../../utils/coordinateTransforms";
import { CanvasPoint, LogicalPoint } from "../../types/coordinates.ts";
import { useVisibleLegos } from "../../hooks/useVisibleLegos.ts";

interface DragProxyProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

// Separate handler for single lego drags
const SingleLegoDragProxy: React.FC<{
  mousePos: { x: number; y: number };
  canvasRect: DOMRect | null;
}> = ({ mousePos, canvasRect }) => {
  const { dragState, viewport } = useCanvasStore();
  const visibleLegos = useVisibleLegos();
  const zoomLevel = viewport.zoomLevel;

  // Memoize the dragged lego to prevent stale references
  const draggedLego = useMemo(() => {
    if (!dragState || dragState.draggedLegoIndex < 0) return null;
    return visibleLegos[dragState.draggedLegoIndex] || null;
  }, [visibleLegos, dragState]);

  if (!dragState || dragState.draggingStage !== DraggingStage.DRAGGING) {
    return null;
  }

  if (!draggedLego || !canvasRect) return null;

  // Convert mouse position to canvas coordinates using cached rect
  const canvasHtmlMousePoint = new CanvasPoint(
    mousePos.x - canvasRect.left,
    mousePos.y - canvasRect.top
  );

  // Convert drag start position to canvas coordinates using cached rect
  const canvasHtmlDragStartPoint = new CanvasPoint(
    dragState.startX - canvasRect.left,
    dragState.startY - canvasRect.top
  );

  // Calculate delta in canvas coordinates - need to account for zoom
  const canvasHtmlDelta = canvasHtmlMousePoint.minus(canvasHtmlDragStartPoint);

  // Transform screen delta to canvas delta for zoom-aware movement
  const canvasDelta = canvasHtmlDelta.factor(1 / zoomLevel);

  // Calculate proxy position: original lego position + canvas delta
  const baseProxyPoint = dragState.originalPoint.plus(canvasDelta);

  // Apply zoom transformation to get screen position using new coordinate system
  const screenProxyPos = viewport.convertToCanvasPoint(baseProxyPoint);

  // Use smart sizing for consistency
  const originalSize = draggedLego.style!.size;
  const smartSize = getSmartLegoSize(originalSize, zoomLevel);

  return (
    <div
      key={`single-drag-proxy-${draggedLego.instanceId}`}
      style={{
        position: "absolute",
        left: `${screenProxyPos.x - smartSize / 2}px`,
        top: `${screenProxyPos.y - smartSize / 2}px`,
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
  mousePos: { x: number; y: number };
  canvasRect: DOMRect | null;
}> = ({ mousePos, canvasRect }) => {
  const { dragState, groupDragState, viewport } = useCanvasStore();
  const visibleLegos = useVisibleLegos();

  const zoomLevel = viewport.zoomLevel;

  // Memoize dragged legos to prevent stale references
  const draggedLegos = useMemo(() => {
    if (!groupDragState) return [];
    return visibleLegos.filter((lego) =>
      groupDragState.legoInstanceIds.includes(lego.instanceId)
    );
  }, [visibleLegos, groupDragState]);

  if (
    !groupDragState ||
    !dragState ||
    dragState.draggingStage !== DraggingStage.DRAGGING ||
    !canvasRect
  ) {
    return null;
  }

  if (draggedLegos.length === 0) return null;

  // Convert mouse position to canvas coordinates using cached rect
  const canvasMouseX = mousePos.x - canvasRect.left;
  const canvasMouseY = mousePos.y - canvasRect.top;

  // Convert drag start position to canvas coordinates using cached rect
  const canvasStartX = dragState.startX - canvasRect.left;
  const canvasStartY = dragState.startY - canvasRect.top;

  // Calculate delta in canvas coordinates - need to account for zoom
  const deltaScreenX = canvasMouseX - canvasStartX;
  const deltaScreenY = canvasMouseY - canvasStartY;

  // Transform screen delta to canvas delta for zoom-aware movement
  const deltaX = deltaScreenX / zoomLevel;
  const deltaY = deltaScreenY / zoomLevel;

  return (
    <>
      {draggedLegos.map((lego: DroppedLego) => {
        const originalPos = groupDragState.originalPositions[lego.instanceId];
        if (!originalPos) return null; // Safety check for stale state

        // Calculate base proxy position in canvas coordinates
        const baseProxyX = originalPos.x + deltaX;
        const baseProxyY = originalPos.y + deltaY;

        // Apply zoom transformation to get screen position using new coordinate system
        const screenProxyPos = viewport.convertToCanvasPoint(
          new LogicalPoint(baseProxyX, baseProxyY)
        );

        // Use smart sizing for consistency
        const originalSize = lego.style!.size;
        const smartSize = getSmartLegoSize(originalSize, zoomLevel);

        return (
          <div
            key={`group-drag-proxy-${lego.instanceId}`}
            style={{
              position: "absolute",
              left: `${screenProxyPos.x - smartSize / 2}px`,
              top: `${screenProxyPos.y - smartSize / 2}px`,
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
  canvasRef: React.RefObject<HTMLDivElement | null>;
}> = ({ canvasRef }) => {
  const { buildingBlockDragState } = useBuildingBlockDragStateStore();
  const { viewport } = useCanvasStore();
  const zoomLevel = viewport.zoomLevel;

  if (
    !buildingBlockDragState.isDragging ||
    !buildingBlockDragState.draggedLego ||
    !canvasRef?.current
  ) {
    return null;
  }

  const canvasRect = canvasRef.current.getBoundingClientRect();
  const isMouseOverCanvas =
    buildingBlockDragState.mouseX >= canvasRect.left &&
    buildingBlockDragState.mouseX <= canvasRect.right &&
    buildingBlockDragState.mouseY >= canvasRect.top &&
    buildingBlockDragState.mouseY <= canvasRect.bottom;

  if (!isMouseOverCanvas) return null;

  const lego = buildingBlockDragState.draggedLego;
  const numLegs = lego.parity_check_matrix[0].length / 2;

  const style = getLegoStyle(
    lego.id,
    numLegs,
    new DroppedLego(lego, new LogicalPoint(0, 0), "dummy")
  );

  // Use smart sizing for building block drag proxy
  const smartSize = getSmartLegoSize(style.size, zoomLevel);

  // Convert global mouse coordinates to canvas-relative coordinates
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

export const DragProxy: React.FC<DragProxyProps> = ({ canvasRef }) => {
  // Track mouse position internally to avoid re-rendering parent components
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dragStateStage = useCanvasStore(
    (state) => state.dragState?.draggingStage
  );
  const groupDragState = useCanvasStore((state) => state.groupDragState);
  const buildingBlockDragState = useBuildingBlockDragStateStore(
    (state) => state.buildingBlockDragState
  );

  // Cache canvas rect to avoid getBoundingClientRect on every render
  useEffect(() => {
    if (canvasRef.current) {
      const updateCanvasRect = () => {
        if (canvasRef.current) {
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

  // Update mouse position on mouse move - only for canvas lego dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Only update state when dragging canvas legos to avoid unnecessary re-renders
      if (
        dragStateStage === DraggingStage.MAYBE_DRAGGING ||
        dragStateStage === DraggingStage.DRAGGING
      ) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          setMousePos({ x: e.clientX, y: e.clientY });
        });
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dragStateStage, buildingBlockDragState]);

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
