import React, { memo, useMemo, useEffect, useState } from "react";
import { DroppedLegoDisplay } from "./DroppedLegoDisplay";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { useShallow } from "zustand/react/shallow";

interface LegosLayerProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

// Hook to get viewport bounds
const useViewportBounds = () => {
  const [viewportBounds, setViewportBounds] = useState({
    left: 0,
    top: 0,
    right: 0,
    bottom: 0
  });

  useEffect(() => {
    const updateViewportBounds = () => {
      const canvasPanel = document.querySelector("#main-panel");
      if (canvasPanel) {
        const rect = canvasPanel.getBoundingClientRect();
        // Add some padding to render legos slightly outside viewport
        const padding = 200;
        setViewportBounds({
          left: -padding,
          top: -padding,
          right: rect.width + padding,
          bottom: rect.height + padding
        });
      }
    };

    // Update on mount
    updateViewportBounds();

    // Update on window resize
    window.addEventListener("resize", updateViewportBounds);

    // Use ResizeObserver for the canvas panel specifically
    const canvasPanel = document.querySelector("#main-panel");
    let resizeObserver: ResizeObserver | null = null;

    if (canvasPanel) {
      resizeObserver = new ResizeObserver(updateViewportBounds);
      resizeObserver.observe(canvasPanel);
    }

    return () => {
      window.removeEventListener("resize", updateViewportBounds);
      if (resizeObserver && canvasPanel) {
        resizeObserver.unobserve(canvasPanel);
      }
    };
  }, []);

  return viewportBounds;
};

export const LegosLayer: React.FC<LegosLayerProps> = memo(({ canvasRef }) => {
  const viewportBounds = useViewportBounds();
  const droppedLegoIds = useCanvasStore(
    useShallow((state) => state.droppedLegos.map((l) => l.instanceId))
  );

  // const { dragState } = useDragStateStore();

  // useEffect(() => {
  //   console.log("legoslayer tensorNetwork changed");
  // }, [tensorNetwork]);
  // useEffect(() => {
  //   console.log("legoslayer dragState changed");
  // }, [dragState]);

  // Check which legos are being dragged to hide them (proxy will show instead)
  // const isDraggedLego = useMemo(() => {
  //   const draggedIds = new Set<string>();

  //   // Add individually dragged lego
  //   if (dragState?.draggingStage === DraggingStage.DRAGGING) {
  //     const draggedLego = droppedLegos[dragState.draggedLegoIndex];
  //     if (draggedLego) {
  //       draggedIds.add(draggedLego.instanceId);
  //     }
  //   }

  //   // Add group dragged legos (selected legos)
  //   if (tensorNetwork?.legos) {
  //     tensorNetwork.legos.forEach((lego) => {
  //       if (dragState?.draggingStage === DraggingStage.DRAGGING) {
  //         draggedIds.add(lego.instanceId);
  //       }
  //     });
  //   }

  //   return (legoId: string) => draggedIds.has(legoId);
  // }, [dragState, droppedLegos, tensorNetwork]);

  const renderedLegos = useMemo(() => {
    return droppedLegoIds.map((instanceId) => (
      <DroppedLegoDisplay
        key={instanceId}
        instanceId={instanceId}
        demoMode={false}
        canvasRef={canvasRef}
      />
    ));
  }, [viewportBounds, droppedLegoIds, canvasRef]);

  return <>{renderedLegos}</>;
});

LegosLayer.displayName = "LegosLayer";
