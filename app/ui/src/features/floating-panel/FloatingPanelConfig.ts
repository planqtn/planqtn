export interface PanelLayout {
  position: { x: number; y: number };
  size: { width: number; height: number };
}

export interface FloatingPanelConfig {
  id: string;
  title: string;
  isOpen: boolean;
  isCollapsed: boolean;
  layout: PanelLayout;
  minWidth?: number;
  minHeight?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultPosition?: { x: number; y: number };
  zIndex?: number;
}

export class FloatingPanelConfigManager {
  private config: FloatingPanelConfig;

  constructor(config: FloatingPanelConfig) {
    // Validate and provide fallbacks for missing properties
    this.config = {
      id: config.id || "unknown",
      title: config.title || "Panel",
      isOpen: config.isOpen ?? false,
      isCollapsed: config.isCollapsed ?? false,
      layout: config.layout || {
        position: config.defaultPosition || { x: 100, y: 100 },
        size: {
          width: config.defaultWidth || 300,
          height: config.defaultHeight || 400
        }
      },
      minWidth: config.minWidth || 100,
      minHeight: config.minHeight || 100,
      defaultWidth: config.defaultWidth || 300,
      defaultHeight: config.defaultHeight || 400,
      defaultPosition: config.defaultPosition || { x: 100, y: 100 },
      zIndex: config.zIndex || 1000
    };

    // Ensure layout has valid position and size
    if (!this.config.layout.position) {
      this.config.layout.position = this.config.defaultPosition || {
        x: 100,
        y: 100
      };
    }
    if (!this.config.layout.size) {
      this.config.layout.size = {
        width: this.config.defaultWidth || 300,
        height: this.config.defaultHeight || 400
      };
    }
  }

  // Getters
  get id(): string {
    return this.config.id;
  }
  get title(): string {
    return this.config.title;
  }
  get isOpen(): boolean {
    return this.config.isOpen;
  }
  get isCollapsed(): boolean {
    return this.config.isCollapsed;
  }
  get layout(): PanelLayout {
    return this.config.layout;
  }
  get minWidth(): number {
    return this.config.minWidth || 100;
  }
  get minHeight(): number {
    return this.config.minHeight || 100;
  }
  get defaultWidth(): number {
    return this.config.defaultWidth || 100;
  }
  get defaultHeight(): number {
    return this.config.defaultHeight || 100;
  }
  get defaultPosition(): { x: number; y: number } {
    return this.config.defaultPosition || { x: 100, y: 100 };
  }
  get zIndex(): number {
    return this.config.zIndex || 1000;
  }

  // Setters
  setIsOpen(isOpen: boolean): void {
    this.config.isOpen = isOpen;
  }

  setIsCollapsed(isCollapsed: boolean): void {
    this.config.isCollapsed = isCollapsed;
  }

  setLayout(layout: PanelLayout): void {
    this.config.layout = layout;
  }

  updatePosition(position: { x: number; y: number }): void {
    this.config.layout.position = position;
  }

  updateSize(size: { width: number; height: number }): void {
    this.config.layout.size = size;
  }

  setZIndex(zIndex: number): void {
    this.config.zIndex = zIndex;
  }

  // Utility methods
  constrainToViewport(): void {
    const maxX = window.innerWidth - this.config.layout.size.width;
    const maxY = window.innerHeight - this.config.layout.size.height;

    this.config.layout.position = {
      x: Math.max(0, Math.min(this.config.layout.position.x, maxX)),
      y: Math.max(0, Math.min(this.config.layout.position.y, maxY))
    };
  }

  constrainToViewportCollapsed(): void {
    const effectiveWidth = 200; // Approximate header width
    const effectiveHeight = 50; // Approximate header height
    const maxX = window.innerWidth - effectiveWidth;
    const maxY = window.innerHeight - effectiveHeight;

    this.config.layout.position = {
      x: Math.max(0, Math.min(this.config.layout.position.x, maxX)),
      y: Math.max(0, Math.min(this.config.layout.position.y, maxY))
    };
  }

  resetToDefaults(): void {
    this.config.layout = {
      position: this.defaultPosition,
      size: { width: this.defaultWidth, height: this.defaultHeight }
    };
  }

  // Serialization
  public static fromJSON(json: unknown): FloatingPanelConfigManager {
    // Validate the JSON data and provide fallbacks
    const configData = json as Partial<FloatingPanelConfig>;

    // Ensure we have a valid layout object
    if (!configData.layout || typeof configData.layout !== "object") {
      configData.layout = {
        position: configData.defaultPosition || { x: 100, y: 100 },
        size: {
          width: configData.defaultWidth || 300,
          height: configData.defaultHeight || 400
        }
      };
    }

    // Ensure layout has valid position and size
    if (
      !configData.layout.position ||
      typeof configData.layout.position !== "object"
    ) {
      configData.layout.position = configData.defaultPosition || {
        x: 100,
        y: 100
      };
    }
    if (!configData.layout.size || typeof configData.layout.size !== "object") {
      configData.layout.size = {
        width: configData.defaultWidth || 300,
        height: configData.defaultHeight || 400
      };
    }

    return new FloatingPanelConfigManager(configData as FloatingPanelConfig);
  }

  public toJSON(): FloatingPanelConfig {
    return { ...this.config };
  }
}
