import React, { memo, useMemo } from "react";
import { DroppedLegoDisplay } from "./DroppedLegoDisplay";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { useShallow } from "zustand/react/shallow";
import { DraggingStage } from "../../stores/legoDragState";
import { useVisibleLegos } from "../../hooks/useVisibleLegos";

interface LegosLayerProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export const LegosLayer: React.FC<LegosLayerProps> = memo(({ canvasRef }) => {
  // Use the new coordinate system with virtualization
  const visibleLegos = useVisibleLegos();
  const viewport = useCanvasStore((state) => state.viewport);

  // Get drag state to hide dragged legos (proxy will show instead)
  const { dragState, tensorNetwork } = useCanvasStore(
    useShallow((state) => ({
      dragState: state.dragState,
      tensorNetwork: state.tensorNetwork
    }))
  );

  // Check which legos are being dragged to hide them
  const isDraggedLego = useMemo(() => {
    const draggedIds = new Set<string>();

    // Add individually dragged lego
    if (dragState?.draggingStage === DraggingStage.DRAGGING) {
      const droppedLegos = useCanvasStore.getState().droppedLegos;
      const draggedLego = droppedLegos[dragState.draggedLegoIndex];
      if (draggedLego) {
        draggedIds.add(draggedLego.instanceId);
      }
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
  }, [dragState, tensorNetwork]);

  // Render only visible legos (virtualization)
  const renderedLegos = useMemo(() => {
    return visibleLegos
      .filter((lego) => !isDraggedLego(lego.instanceId)) // Hide dragged legos
      .map((lego) => (
        <DroppedLegoDisplay
          key={lego.instanceId}
          lego={lego}
          demoMode={false}
          canvasRef={canvasRef}
          canvasPosition={lego.canvasPosition!}
        />
      ));
  }, [visibleLegos, isDraggedLego, canvasRef, viewport.logicalPanOffset]);

  return <>{renderedLegos}</>;
});

LegosLayer.displayName = "LegosLayer";
