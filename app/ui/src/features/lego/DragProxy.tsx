import React, { useRef, useEffect, useState, useMemo } from "react";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { DraggingStage } from "../../stores/legoDragState";
import { useBuildingBlockDragStateStore } from "../../stores/buildingBlockDragStateStore";
import { LogicalPoint, WindowPoint } from "../../types/coordinates.ts";
import { useDebugStore } from "../../stores/debugStore.ts";
import DroppedLegoDisplay, {
  getLegoBodyBoundingBox
} from "./DroppedLegoDisplay";

// Separate handler for single lego drags
const SingleLegoDragProxy: React.FC<{
  mousePos: WindowPoint;
  canvasRect: DOMRect | null;
}> = ({ mousePos, canvasRect }) => {
  const legoDragState = useCanvasStore((state) => state.legoDragState);
  const viewport = useCanvasStore((state) => state.viewport);
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const zoomLevel = viewport.zoomLevel;

  const mouseStartingGrabDeltaWindow =
    legoDragState?.startMouseWindowPoint.minus(
      viewport.fromLogicalToWindow(legoDragState?.startLegoLogicalPoint)
    );

  // Memoize the dragged lego to prevent stale references
  const draggedLego = useMemo(() => {
    if (!legoDragState || legoDragState.draggedLegoInstanceId === "")
      return null;
    return droppedLegos.find(
      (lego) => lego.instance_id === legoDragState.draggedLegoInstanceId
    );
  }, [droppedLegos, legoDragState]);

  // Create a demo lego for the drag proxy - always call hooks, even if null
  const demoLego = useMemo(() => {
    if (!draggedLego) return null;
    return draggedLego.with({
      logicalPosition: new LogicalPoint(0, 0)
    });
  }, [draggedLego]);

  const boundingBox = useMemo(() => {
    if (!demoLego) return null;
    return getLegoBodyBoundingBox(demoLego, false, zoomLevel);
  }, [demoLego, zoomLevel]);

  // Clone the SVG body element from the DOM
  const clonedBodyElement = useMemo(() => {
    if (!draggedLego) return null;

    // First try to get the DOM element for the current lego
    let bodyElement = document.getElementById(
      `lego-${draggedLego.instance_id}-body`
    );

    // If not found, check if this is a cloned lego and try to use the original lego's DOM element
    if (!bodyElement) {
      const cloneMapping = useCanvasStore.getState().cloneMapping;
      const originalLegoId = cloneMapping.get(draggedLego.instance_id);
      if (originalLegoId) {
        bodyElement = document.getElementById(`lego-${originalLegoId}-body`);
      }
    }

    if (!bodyElement) return null;
    return bodyElement.cloneNode(true) as SVGElement;
  }, [draggedLego]);

  // Early returns after all hooks are called
  if (
    !legoDragState ||
    legoDragState.draggingStage !== DraggingStage.DRAGGING
  ) {
    return null;
  }

  if (!draggedLego || !canvasRect || !demoLego || !boundingBox) return null;

  // Apply zoom transformation to get screen position using new coordinate system
  const proxyCanvasPos = viewport.fromWindowToCanvas(
    mousePos.minus(mouseStartingGrabDeltaWindow)
  );

  // Use cloned DOM element if available, otherwise fall back to DroppedLegoDisplay
  if (clonedBodyElement) {
    return (
      <div
        key={`single-drag-proxy-${draggedLego.instance_id}`}
        style={{
          position: "absolute",
          left: `${proxyCanvasPos.x - boundingBox.width / 2}px`,
          top: `${proxyCanvasPos.y - boundingBox.height / 2}px`,
          width: `${boundingBox.width}px`,
          height: `${boundingBox.height}px`,
          opacity: 0.7,
          filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
          transition: "none",
          pointerEvents: "none",
          zIndex: 1000,
          border: "1px solid red"
        }}
      >
        <svg
          width={boundingBox.width}
          height={boundingBox.height}
          style={{ overflow: "visible" }}
          viewBox={`${boundingBox.left} ${boundingBox.top} ${boundingBox.width} ${boundingBox.height}`}
          ref={(svgRef) => {
            if (svgRef && clonedBodyElement) {
              svgRef.innerHTML = "";
              svgRef.appendChild(clonedBodyElement.cloneNode(true));
            }
          }}
        ></svg>
      </div>
    );
  } else {
    return null;
  }
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
      groupDragState.legoInstanceIds.includes(lego.instance_id)
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
        const originalPos = groupDragState.originalPositions[lego.instance_id];
        if (!originalPos) return null; // Safety check for stale state

        // Calculate base proxy position in canvas coordinates
        const baseProxy = originalPos.plus(deltaLogical);

        // Apply zoom transformation to get screen position using new coordinate system
        const proxyCanvasPos = viewport.fromLogicalToCanvas(baseProxy);
        // .minus(mouseStartingGrabDeltaWindow);

        // Create a demo lego for the drag proxy
        const demoLego = lego.with({
          logicalPosition: new LogicalPoint(0, 0)
        });

        const boundingBox = getLegoBodyBoundingBox(demoLego, false, zoomLevel);

        // Clone the SVG body element from the DOM
        const bodyElement = (() => {
          // First try to get the DOM element for the current lego
          let bodyElement = document.getElementById(
            `lego-${lego.instance_id}-body`
          );

          // If not found, check if this is a cloned lego and try to use the original lego's DOM element
          if (!bodyElement) {
            console.log("no body element found for lego", lego.instance_id);
            const cloneMapping = useCanvasStore.getState().cloneMapping;
            const originalLegoId = cloneMapping.get(lego.instance_id);
            if (originalLegoId) {
              bodyElement = document.getElementById(
                `lego-${originalLegoId}-body`
              );
            }
          }

          return bodyElement?.cloneNode(true) as SVGElement;
        })();

        if (!bodyElement) {
          // Fallback to DroppedLegoDisplay for newly cloned legos
          return null;
        }

        return (
          <div
            key={`group-drag-proxy-${lego.instance_id}`}
            style={{
              position: "absolute",
              left: `${proxyCanvasPos.x - boundingBox.width / 2}px`,
              top: `${proxyCanvasPos.y - boundingBox.height / 2}px`,
              width: `${boundingBox.width}px`,
              height: `${boundingBox.height}px`,
              opacity: 0.7,
              filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
              transition: "none",
              pointerEvents: "none",
              zIndex: 1000,
              border: "1px solid red"
            }}
          >
            <svg
              width={boundingBox.width}
              height={boundingBox.height}
              style={{ overflow: "visible" }}
              viewBox={`${boundingBox.left} ${boundingBox.top} ${boundingBox.width} ${boundingBox.height}`}
              ref={(svgRef) => {
                if (svgRef && bodyElement) {
                  svgRef.innerHTML = "";
                  svgRef.appendChild(bodyElement.cloneNode(true));
                }
              }}
            ></svg>
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

  // Create a demo lego for the drag proxy
  const demoLego = new DroppedLego(lego, new LogicalPoint(0, 0), "dummy");
  const boundingBox = getLegoBodyBoundingBox(demoLego, false, zoomLevel);

  // Convert global mouse coordinates to canvas-relative coordinates (use buildingBlockDragState)
  const canvasX = buildingBlockDragState.mouseX - canvasRect.left;
  const canvasY = buildingBlockDragState.mouseY - canvasRect.top;

  return (
    <div
      style={{
        position: "absolute",
        left: `${canvasX - boundingBox.width / 2}px`,
        top: `${canvasY - boundingBox.height / 2}px`,
        width: `${boundingBox.width}px`,
        height: `${boundingBox.height}px`,
        opacity: 0.7,
        transform: "scale(1.1)",
        filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
        transition: "none",
        pointerEvents: "none",
        zIndex: 1000
      }}
    >
      <svg
        width={boundingBox.width}
        height={boundingBox.height}
        style={{ overflow: "visible" }}
        viewBox={`${boundingBox.left} ${boundingBox.top} ${boundingBox.width} ${boundingBox.height}`}
      >
        <DroppedLegoDisplay
          legoInstanceId="-1"
          demoLego={demoLego}
          forceSmartSizing={true}
          bodyOnly={true}
        />
      </svg>
    </div>
  );
};

const ResizeGroupProxy: React.FC<{
  legos: DroppedLego[];
  canvasRect: DOMRect | null;
}> = ({ legos, canvasRect }) => {
  const viewport = useCanvasStore((state) => state.viewport);
  const zoomLevel = viewport.zoomLevel;
  if (!canvasRect || !legos.length) return null;
  return (
    <>
      {legos.map((lego) => {
        const proxyCanvasPos = viewport.fromLogicalToCanvas(
          lego.logicalPosition
        );

        // Create a demo lego for the resize proxy
        const demoLego = lego.with({
          logicalPosition: new LogicalPoint(0, 0)
        });

        const boundingBox = getLegoBodyBoundingBox(demoLego, false, zoomLevel);

        // Clone the SVG body element from the DOM
        const clonedBodyElement = (() => {
          // First try to get the DOM element for the current lego
          let bodyElement = document.getElementById(
            `lego-${lego.instance_id}-body`
          );

          // If not found, check if this is a cloned lego and try to use the original lego's DOM element
          if (!bodyElement) {
            const cloneMapping = useCanvasStore.getState().cloneMapping;
            const originalLegoId = cloneMapping.get(lego.instance_id);
            if (originalLegoId) {
              bodyElement = document.getElementById(
                `lego-${originalLegoId}-body`
              );
            }
          }

          return bodyElement?.cloneNode(true) as SVGElement;
        })();

        if (!clonedBodyElement) {
          // Fallback to DroppedLegoDisplay for newly cloned legos
          return (
            <div
              key={`resize-group-proxy-fallback-${lego.instance_id}`}
              style={{
                position: "absolute",
                left: `${proxyCanvasPos.x - boundingBox.width / 2}px`,
                top: `${proxyCanvasPos.y - boundingBox.height / 2}px`,
                width: `${boundingBox.width}px`,
                height: `${boundingBox.height}px`,
                opacity: 0.5,
                border: "1.5px dashed #4A90E2",
                background: "none",
                pointerEvents: "none",
                zIndex: 1000
              }}
            >
              <svg
                width={boundingBox.width}
                height={boundingBox.height}
                style={{ overflow: "visible" }}
                viewBox={`${boundingBox.left} ${boundingBox.top} ${boundingBox.width} ${boundingBox.height}`}
              >
                <DroppedLegoDisplay
                  legoInstanceId={lego.instance_id}
                  demoLego={demoLego}
                  forceSmartSizing={true}
                  bodyOnly={true}
                />
              </svg>
            </div>
          );
        }

        return (
          <div
            key={`resize-group-proxy-${lego.instance_id}`}
            style={{
              position: "absolute",
              left: `${proxyCanvasPos.x - boundingBox.width / 2}px`,
              top: `${proxyCanvasPos.y - boundingBox.height / 2}px`,
              width: `${boundingBox.width}px`,
              height: `${boundingBox.height}px`,
              opacity: 0.5,
              border: "1.5px dashed #4A90E2",
              background: "none",
              pointerEvents: "none",
              zIndex: 1000
            }}
          >
            <svg
              width={boundingBox.width}
              height={boundingBox.height}
              style={{ overflow: "visible" }}
              viewBox={`${boundingBox.left} ${boundingBox.top} ${boundingBox.width} ${boundingBox.height}`}
              ref={(svgRef) => {
                if (svgRef && clonedBodyElement) {
                  svgRef.innerHTML = "";
                  svgRef.appendChild(clonedBodyElement.cloneNode(true));
                }
              }}
            ></svg>
          </div>
        );
      })}
    </>
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
  const resizeProxyLegos = useCanvasStore((state) => state.resizeProxyLegos);

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
      {/* Resize proxy takes precedence */}
      {resizeProxyLegos && resizeProxyLegos.length > 0 ? (
        <ResizeGroupProxy legos={resizeProxyLegos} canvasRect={canvasRect} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
};

DragProxy.displayName = "DragProxy";
