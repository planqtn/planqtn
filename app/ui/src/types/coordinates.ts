// Explicit coordinate system types for type safety and code clarity

export abstract class Coordinate {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Subtract another coordinate from this one
   */
  minus(other: Coordinate): this {
    return new (this.constructor as new (x: number, y: number) => this)(
      this.x - other.x,
      this.y - other.y
    );
  }

  /**
   * Add another coordinate to this one
   */
  plus(other: Coordinate): this {
    return new (this.constructor as new (x: number, y: number) => this)(
      this.x + other.x,
      this.y + other.y
    );
  }

  /**
   * Multiply this coordinate by a scalar factor
   */
  factor(scalar: number): this {
    return new (this.constructor as new (x: number, y: number) => this)(
      this.x * scalar,
      this.y * scalar
    );
  }
}

/**
 * Raw window coordinates from mouse events (clientX, clientY)
 * Origin: top-left of the browser window
 */
export class WindowPoint extends Coordinate {
  // Use a unique string literal type for nominal typing
  // @ts-expect-error - Brand property for nominal typing
  private readonly __brand: "WindowPoint" = "WindowPoint" as const;

  static fromMouseEvent(e: MouseEvent): WindowPoint {
    return new WindowPoint(e.clientX, e.clientY);
  }
}

/**
 * Coordinates relative to the canvas HTML div element
 * Origin: top-left of the canvas div
 * These are pixel coordinates within the canvas element bounds
 */
export class CanvasPoint extends Coordinate {
  // @ts-expect-error - Brand property for nominal typing
  private readonly __brand: "CanvasPoint" = "CanvasPoint" as const;
}

/**
 * True virtual canvas coordinates (logical world space)
 * Origin: top left of the canvas (0,0 at top left)
 * These are the persistent coordinates where legos actually exist
 * Independent of zoom/pan transformations
 */
export class LogicalPoint extends Coordinate {
  // @ts-expect-error - Brand property for nominal typing
  private readonly __brand: "LogicalPoint" = "LogicalPoint" as const;
}

/**
 * Coordinates relative to the miniature canvas representation in the minimap
 * Origin: top-left of the minimap schematic area
 * Expressed as percentages (0-100) of the minimap dimensions
 */
export class MiniCanvasPoint extends Coordinate {
  // @ts-expect-error - Brand property for nominal typing
  private readonly __brand: "MiniCanvasPoint" = "MiniCanvasPoint" as const;
}

// Type guards for runtime coordinate system verification
export const isWindowPoint = (point: unknown): point is WindowPoint => {
  return (
    typeof point === "object" &&
    point !== null &&
    typeof (point as WindowPoint).x === "number" &&
    typeof (point as WindowPoint).y === "number"
  );
};

export const isCanvasHtmlPoint = (point: unknown): point is CanvasPoint => {
  return (
    typeof point === "object" &&
    point !== null &&
    typeof (point as CanvasPoint).x === "number" &&
    typeof (point as CanvasPoint).y === "number"
  );
};

export const isCanvasPoint = (point: unknown): point is LogicalPoint => {
  return (
    typeof point === "object" &&
    point !== null &&
    typeof (point as LogicalPoint).x === "number" &&
    typeof (point as LogicalPoint).y === "number"
  );
};

export const isMiniCanvasPoint = (point: unknown): point is MiniCanvasPoint => {
  return (
    typeof point === "object" &&
    point !== null &&
    typeof (point as MiniCanvasPoint).x === "number" &&
    (point as MiniCanvasPoint).x >= 0 &&
    (point as MiniCanvasPoint).x <= 100 &&
    typeof (point as MiniCanvasPoint).y === "number" &&
    (point as MiniCanvasPoint).y >= 0 &&
    (point as MiniCanvasPoint).y <= 100
  );
};
