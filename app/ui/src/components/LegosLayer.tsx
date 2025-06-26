import React, { memo, useMemo } from "react";
import { DroppedLego, LegDragState, DragState, Connection } from "../lib/types";
import { TensorNetwork } from "../lib/TensorNetwork";
import { DroppedLegoDisplay } from "./DroppedLegoDisplay";

interface LegosLayerProps {
  droppedLegos: DroppedLego[];
  legDragState: LegDragState | null;
  dragState: DragState;
  connections: Connection[];
  tensorNetwork: TensorNetwork | null;
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

export const LegosLayer: React.FC<LegosLayerProps> = memo(
  ({
    droppedLegos,
    legDragState,
    dragState,
    connections,
    tensorNetwork,
    hideConnectedLegs,
    onLegMouseDown,
    onLegoMouseDown,
    onLegoClick,
    onLegClick
  }) => {
    // Memoize the rendered legos to prevent unnecessary re-renders
    const renderedLegos = useMemo(() => {
      return droppedLegos.map((lego, index) => (
        <DroppedLegoDisplay
          key={lego.instanceId}
          lego={lego}
          index={index}
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
      ));
    }, [
      droppedLegos,
      legDragState,
      dragState,
      connections,
      tensorNetwork,
      hideConnectedLegs,
      onLegMouseDown,
      onLegoMouseDown,
      onLegoClick,
      onLegClick
    ]);

    return <>{renderedLegos}</>;
  }
);

LegosLayer.displayName = "LegosLayer";
