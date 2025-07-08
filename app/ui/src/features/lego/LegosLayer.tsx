import React, { Suspense, useMemo } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { useShallow } from "zustand/react/shallow";
import { DraggingStage } from "../../stores/legoDragState";
import { useVisibleLegoIds } from "../../hooks/useVisibleLegos";

const DroppedLegoDisplay = React.lazy(() => import("./DroppedLegoDisplay"));

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
        draggedIds.add(lego.instanceId);
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
      <Suspense fallback={<div>Loading legos...</div>}>
        {renderedLegos}
      </Suspense>

      {tnBoundingBox && (
        <svg
          id="tn-bounding-box"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            zIndex: 1,
            pointerEvents: "none"
          }}
        >
          <rect
            x={tnBoundingBox.minX}
            y={tnBoundingBox.minY}
            width={tnBoundingBox.width}
            height={tnBoundingBox.height}
            fill="none"
            stroke="blue"
            strokeWidth="1"
          />
        </svg>
      )}
    </>
  );
};

LegosLayer.displayName = "LegosLayer";
