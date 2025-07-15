import { LegoStyle, LegStyle } from "./LegoStyles";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { SvgLegoParser, SvgLegoData } from "./SvgLegoParser";
import { PauliOperator } from "../../lib/types";
import { getPauliColor } from "../../lib/PauliColors";
import t6_svg from "./svg-legos/t6-svg";
import t6_flipped_svg from "./svg-legos/t6-flipped-svg";

export abstract class SvgLegoStyle extends LegoStyle {
  public readonly svgData: SvgLegoData;
  private svgContent: string;

  abstract getSvgContent(): string;

  constructor(id: string, lego: DroppedLego) {
    super(id, lego);
    this.svgContent = this.getSvgContent();
    this.svgData = SvgLegoParser.parseSvgFile(this.svgContent);

    // Build legStyles using SVG geometry and app logic for color/highlight
    const legStyles = this.svgData.legs.map((leg, leg_index) => {
      const { isLogical, isHighlighted, highlightOperator } =
        this.calculateLegProps(leg_index);

      const position = {
        startX: leg.startX,
        startY: leg.startY,
        endX: leg.endX,
        endY: leg.endY,
        labelX: leg.labelX,
        labelY: leg.labelY,
        angle: Math.atan2(leg.endY - leg.startY, leg.endX - leg.startX)
      };

      return {
        angle: position.angle,
        length: Math.sqrt(
          (leg.endX - leg.startX) ** 2 + (leg.endY - leg.startY) ** 2
        ),
        width:
          !isLogical && highlightOperator === PauliOperator.I ? "1px" : "3px",
        lineStyle: "solid",
        from: leg.from,
        startOffset: leg.startOffset,
        color: getPauliColor(highlightOperator, true),
        is_highlighted: isHighlighted,
        type: leg.type,
        position,
        bodyOrder: leg.bodyOrder
      } as LegStyle;
    });

    Object.defineProperty(this, "legStyles", {
      value: legStyles,
      writable: false,
      configurable: true
    });
  }

  get size(): number {
    // Extract size from SVG viewBox or use default
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(this.svgContent, "image/svg+xml");
      const svg = doc.documentElement;
      const viewBox = svg.getAttribute("viewBox");
      if (viewBox) {
        const [, , width, height] = viewBox.split(" ").map(Number);
        return Math.max(width, height);
      }
    } catch {
      console.warn("Could not parse SVG size, using default");
    }
    return 50; // Default size
  }

  get borderRadius(): string {
    // Check if body has rounded corners
    if (this.svgData.body.attributes.rx || this.svgData.body.attributes.ry) {
      return "full";
    }
    return "0";
  }

  get backgroundColor(): string {
    return this.svgData.colors.background;
  }

  get borderColor(): string {
    return this.svgData.colors.border;
  }

  get selectedBackgroundColor(): string {
    return this.svgData.colors.selectedBackground;
  }

  get selectedBorderColor(): string {
    return this.svgData.colors.selectedBorder;
  }

  get displayShortName(): boolean {
    return !!(this.svgData.text.shortName || this.svgData.text.combined);
  }

  // Override to use SVG-derived leg positions
  getLegHighlightPauliOperator = (leg_index: number) => {
    // Use the same logic as the parent class
    const h = this.lego.parity_check_matrix;
    const num_legs = h[0].length / 2;

    if (this.lego.selectedMatrixRows === undefined) {
      return PauliOperator.I;
    }

    const combinedRow = new Array(this.lego.parity_check_matrix[0].length).fill(
      0
    );

    for (const rowIndex of this.lego.selectedMatrixRows) {
      this.lego.parity_check_matrix[rowIndex].forEach((val, idx) => {
        combinedRow[idx] = (combinedRow[idx] + val) % 2;
      });
    }

    const xPart = combinedRow[leg_index];
    const zPart = combinedRow[leg_index + num_legs];

    if (xPart === 1 && zPart === 0) return PauliOperator.X;
    if (xPart === 0 && zPart === 1) return PauliOperator.Z;
    if (xPart === 1 && zPart === 1) return PauliOperator.Y;

    return PauliOperator.I;
  };

  // Method to get SVG body element for rendering
  getSvgBodyElement(): string {
    return this.svgData.body.element;
  }

  // Method to get text positioning data
  getTextData() {
    return this.svgData.text;
  }
}

export class T6SvgLegoStyle extends SvgLegoStyle {
  getSvgContent(): string {
    return t6_svg;
  }
}

export class T6FlippedSvgLegoStyle extends SvgLegoStyle {
  getSvgContent(): string {
    return t6_flipped_svg;
  }
}
