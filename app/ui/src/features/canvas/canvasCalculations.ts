import { Viewport } from "@/stores/canvasUISlice.ts";
import { Connection } from "../../stores/connectionStore";
import { DroppedLego } from "../../stores/droppedLegoStore.ts";
import { CanvasPoint, LogicalPoint } from "../../types/coordinates.ts";

// Add this before the App component
export const findClosestDanglingLeg = (
  dropPosition: LogicalPoint,
  droppedLegos: DroppedLego[],
  connections: Connection[],
  viewport: Viewport
): { lego: DroppedLego; leg_index: number; distance: number } | null => {
  let closestLego: DroppedLego | null = null;
  let closestLegIndex: number = -1;
  let minDistance = Infinity;

  const dropPositionCanvas = viewport.fromLogicalToCanvas(dropPosition);

  droppedLegos.forEach((lego) => {
    const totalLegs = lego.numberOfLegs;
    for (let leg_index = 0; leg_index < totalLegs; leg_index++) {
      // Skip if leg is already connected
      const isConnected = connections.some(
        (conn) =>
          (conn.from.legoId === lego.instance_id &&
            conn.from.leg_index === leg_index) ||
          (conn.to.legoId === lego.instance_id &&
            conn.to.leg_index === leg_index)
      );
      if (isConnected) continue;

      const pos = lego.style!.legStyles[leg_index].position;
      // Leg positions are in canvas units, we don't scale them
      const legCanvas = viewport
        .fromLogicalToCanvas(lego.logicalPosition)
        .plus(new CanvasPoint(pos.endX, pos.endY));

      const distance = dropPositionCanvas.minus(legCanvas).length();

      if (distance < minDistance && distance < 20) {
        // 20 pixels threshold
        minDistance = distance;
        closestLego = lego;
        closestLegIndex = leg_index;
      }
    }
  });

  return closestLego && closestLegIndex !== -1
    ? { lego: closestLego, leg_index: closestLegIndex, distance: minDistance }
    : null;
};
