import React, { memo, useMemo, useEffect, useState } from "react";
import { DroppedLego, LegDragState, DragState, Connection } from "../lib/types";
import { DroppedLegoDisplay, getLegoBoundingBox } from "./DroppedLegoDisplay";
import { useTensorNetworkStore } from "../stores/tensorNetworkStore";

interface LegosLayerProps {
  droppedLegos: DroppedLego[];
  legDragState: LegDragState | null;
  dragState: DragState;
  connections: Connection[];
  hideConnectedLegs: boolean;
  onLegMouseDown: (
    e: React.MouseEvent,
    legoId: string,
    legIndex: number
  ) => void;
  onLegoMouseDown: (e: React.MouseEvent, index: number) => void;
  onLegoClick: (e: React.MouseEvent, lego: DroppedLego) => void;
  onLegClick: (legoId: string, legIndex: number) => void;
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

// Function to check if a lego is visible in the viewport
const isLegoVisible = (
  lego: DroppedLego,
  viewportBounds: { left: number; top: number; right: number; bottom: number }
) => {
  const legoBounds = getLegoBoundingBox(lego, false);

  const legoLeft = lego.x + legoBounds.left;
  const legoTop = lego.y + legoBounds.top;
  const legoRight = lego.x + legoBounds.left + legoBounds.width;
  const legoBottom = lego.y + legoBounds.top + legoBounds.height;

  // Check if lego intersects with viewport
  return !(
    legoRight < viewportBounds.left ||
    legoLeft > viewportBounds.right ||
    legoBottom < viewportBounds.top ||
    legoTop > viewportBounds.bottom
  );
};

export const LegosLayer: React.FC<LegosLayerProps> = memo(
  ({
    droppedLegos,
    legDragState,
    dragState,
    connections,
    hideConnectedLegs,
    onLegMouseDown,
    onLegoMouseDown,
    onLegoClick,
    onLegClick
  }) => {
    const { tensorNetwork } = useTensorNetworkStore();
    const viewportBounds = useViewportBounds();

    // Check which legos are being dragged to hide them (proxy will show instead)
    const isDraggedLego = useMemo(() => {
      const draggedIds = new Set<string>();

      // Add individually dragged lego
      if (dragState.isDragging && dragState.draggedLegoIndex >= 0) {
        const draggedLego = droppedLegos[dragState.draggedLegoIndex];
        if (draggedLego) {
          draggedIds.add(draggedLego.instanceId);
        }
      }

      // Add group dragged legos (selected legos)
      if (tensorNetwork?.legos) {
        tensorNetwork.legos.forEach((lego) => {
          if (dragState.isDragging) {
            draggedIds.add(lego.instanceId);
          }
        });
      }

      return (legoId: string) => draggedIds.has(legoId);
    }, [dragState, droppedLegos, tensorNetwork]);

    // Simple virtualization: only render visible legos (and hide dragged ones)
    const renderedLegos = useMemo(() => {
      return droppedLegos
        .filter((lego) => isLegoVisible(lego, viewportBounds))
        .filter((lego) => !isDraggedLego(lego.instanceId)) // Hide dragged legos
        .map((lego) => {
          const originalIndex = droppedLegos.findIndex(
            (l) => l.instanceId === lego.instanceId
          );
          return (
            <DroppedLegoDisplay
              key={lego.instanceId}
              lego={lego}
              index={originalIndex}
              legDragState={legDragState}
              handleLegMouseDown={onLegMouseDown}
              handleLegoMouseDown={onLegoMouseDown}
              handleLegoClick={onLegoClick}
              tensorNetwork={tensorNetwork}
              dragState={dragState}
              onLegClick={onLegClick}
              hideConnectedLegs={hideConnectedLegs}
              connections={connections}
              droppedLegos={droppedLegos}
              demoMode={false}
            />
          );
        });
    }, [
      droppedLegos,
      viewportBounds,
      legDragState,
      dragState,
      connections,
      tensorNetwork,
      hideConnectedLegs,
      onLegMouseDown,
      onLegoMouseDown,
      onLegoClick,
      onLegClick,
      isDraggedLego
    ]);

    return <>{renderedLegos}</>;
  }
);

LegosLayer.displayName = "LegosLayer";
