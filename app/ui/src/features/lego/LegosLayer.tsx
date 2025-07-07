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
  // Get drag state to hide dragged legos (proxy will show instead)
  const { dragState, tensorNetwork } = useCanvasStore(
    useShallow((state) => ({
      dragState: state.legoDragState,
      tensorNetwork: state.tensorNetwork
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
    <Suspense fallback={<div>Loading legos...</div>}>{renderedLegos}</Suspense>
  );
};

LegosLayer.displayName = "LegosLayer";
