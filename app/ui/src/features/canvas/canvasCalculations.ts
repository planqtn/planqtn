import { Connection } from "../../stores/connectionStore";
import { DroppedLego } from "../../stores/droppedLegoStore.ts";
import { LogicalPoint } from "../../types/coordinates.ts";

// Add these helper functions near the top of the file
export const pointToLineDistance = (
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) {
    param = dot / len_sq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

export const findClosestConnection = (
  dropPosition: LogicalPoint,
  droppedLegos: DroppedLego[],
  connections: Connection[]
): Connection | null => {
  // Find the closest connection
  let closestConnection: Connection | null = null;
  let minDistance = Infinity;

  connections.forEach((conn) => {
    const fromLego = droppedLegos.find(
      (l) => l.instance_id === conn.from.legoId
    );
    const toLego = droppedLegos.find((l) => l.instance_id === conn.to.legoId);
    if (!fromLego || !toLego) return;

    const fromPos = fromLego.style!.legStyles[conn.from.leg_index].position;
    const toPos = toLego.style!.legStyles[conn.to.leg_index].position;

    // Connection positions are in logical canvas coordinates
    const fromPoint = new LogicalPoint(
      fromLego.logicalPosition.x + fromPos.endX,
      fromLego.logicalPosition.y + fromPos.endY
    );
    const toPoint = new LogicalPoint(
      toLego.logicalPosition.x + toPos.endX,
      toLego.logicalPosition.y + toPos.endY
    );

    // Calculate distance from point to line segment - all in canvas coordinates
    const distance = pointToLineDistance(
      dropPosition.x,
      dropPosition.y,
      fromPoint.x,
      fromPoint.y,
      toPoint.x,
      toPoint.y
    );
    if (distance < minDistance && distance < 40) {
      // 40 pixels threshold
      minDistance = distance;
      closestConnection = conn;
    }
  });

  return closestConnection;
};

// Add this before the App component
export const findClosestDanglingLeg = (
  dropPosition: LogicalPoint,
  droppedLegos: DroppedLego[],
  connections: Connection[]
): { lego: DroppedLego; leg_index: number; distance: number } | null => {
  let closestLego: DroppedLego | null = null;
  let closestLegIndex: number = -1;
  let minDistance = Infinity;

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
      // Leg positions are in logical canvas coordinates
      const legX = lego.logicalPosition.x + pos.endX;
      const legY = lego.logicalPosition.y + pos.endY;

      // Calculate distance in canvas coordinate space
      const distance = Math.sqrt(
        Math.pow(dropPosition.x - legX, 2) + Math.pow(dropPosition.y - legY, 2)
      );

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
