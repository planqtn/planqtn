import { LegoStyle, LegStyle } from "./LegoStyles";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { SvgLegoParser, SvgLegoData } from "./SvgLegoParser";
import { PauliOperator } from "../../lib/types";
import { getPauliColor } from "../../lib/PauliColors";
import t6_svg from "./svg-legos/t6-svg";
import t6_flipped_svg from "./svg-legos/t6-flipped-svg";
import t5_flipped_svg from "./svg-legos/t5-flipped-svg";
import t5_svg from "./svg-legos/t5-svg";

export class SvgLegoStyle extends LegoStyle {
  public readonly svgData: SvgLegoData;
  private svgContent: string;

  public static supportedLegoTypes = ["t5", "t5_flipped", "t6", "t6_flipped"];
  public static svgContentMap: Record<string, string> = {
    t5: t5_svg,
    t5_flipped: t5_flipped_svg,
    t6: t6_svg,
    t6_flipped: t6_flipped_svg
  };

  constructor(id: string, lego: DroppedLego, overrideLegStyles?: LegStyle[]) {
    super(id, lego, overrideLegStyles);
    this.svgContent = SvgLegoStyle.svgContentMap[id];
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
    // Calculate size based on the bounding box of the lego-body group element
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(this.svgContent, "image/svg+xml");
      const svg = doc.documentElement;

      // Find the lego-body group element
      const legoBodyGroup = svg.querySelector('[data-role="lego-body"]');

      if (legoBodyGroup) {
        // Create a temporary SVG element to get accurate bounding box
        const tempSvg = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "svg"
        );
        tempSvg.style.visibility = "hidden";
        tempSvg.style.position = "absolute";
        tempSvg.style.top = "-9999px";
        tempSvg.style.left = "-9999px";

        // Clone the lego-body group and add it to the temporary SVG
        const clonedGroup = legoBodyGroup.cloneNode(true) as SVGElement;
        tempSvg.appendChild(clonedGroup);

        // Add to DOM to get accurate measurements
        document.body.appendChild(tempSvg);

        try {
          // Get the bounding box of the lego-body group
          const bbox = (clonedGroup as SVGGraphicsElement).getBBox();
          const size = Math.max(bbox.width, bbox.height);

          // Clean up
          document.body.removeChild(tempSvg);

          return size > 0 ? size : 30; // Fallback to default if size is invalid
        } catch {
          // Clean up on error
          document.body.removeChild(tempSvg);
          throw new Error("Could not get bounding box");
        }
      }

      // Fallback to viewBox if lego-body group not found
      const viewBox = svg.getAttribute("viewBox");
      if (viewBox) {
        const [, , width, height] = viewBox.split(" ").map(Number);
        return Math.max(width, height);
      }
    } catch {
      console.warn("Could not calculate SVG size from bbox, using default");
    }
    return 30;
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
