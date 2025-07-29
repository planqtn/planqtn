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
    this.config = config;
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
    return this.config.minWidth || 200;
  }
  get minHeight(): number {
    return this.config.minHeight || 300;
  }
  get defaultWidth(): number {
    return this.config.defaultWidth || 350;
  }
  get defaultHeight(): number {
    return this.config.defaultHeight || 600;
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
  toJSON(): any {
    return {
      ...this.config,
      layout: { ...this.config.layout }
    };
  }

  static fromJSON(data: any): FloatingPanelConfigManager {
    return new FloatingPanelConfigManager(data);
  }
}
