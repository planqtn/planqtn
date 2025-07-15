import { LegPosition, LegStyle } from "./LegoStyles";
import { PauliOperator } from "../../lib/types";
import { getPauliColor } from "../../lib/PauliColors";

export interface SvgLegoData {
  body: {
    element: string; // SVG element as string
    attributes: Record<string, string>;
  };
  text: {
    shortName?: { x: number; y: number; content: string };
    instanceId?: { x: number; y: number; content: string };
    combined?: { x: number; y: number; yOffset?: number; content: string };
  };
  legs: Array<{
    index: number;
    type: "logical" | "gauge" | "physical";
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    labelX: number;
    labelY: number;
    lineStyle: "solid" | "dashed";
    width: string;
    startOffset: number;
    lineElement?: string; // SVG line element as string
    bodyOrder: "front" | "behind";
  }>;
  colors: {
    background: string;
    border: string;
    selectedBackground: string;
    selectedBorder: string;
  };
}

export class SvgLegoParser {
  static parseSvgFile(svgContent: string): SvgLegoData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");

    if (doc.documentElement.nodeName !== "svg") {
      throw new Error("Invalid SVG file");
    }

    const svg = doc.documentElement;
    const viewBox = svg.getAttribute("viewBox");
    if (!viewBox) {
      throw new Error("SVG must have a viewBox attribute");
    }

    // Parse viewBox to understand coordinate system
    const [, , ,] = viewBox.split(" ").map(Number);

    // Find body element
    const bodyElement = svg.querySelector('[data-role="lego-body"]');
    if (!bodyElement) {
      throw new Error("SVG must contain an element with data-role='lego-body'");
    }

    // Extract body information
    const body = {
      element: bodyElement.outerHTML,
      attributes: this.extractAttributes(bodyElement)
    };

    // Extract text information
    const text = this.extractTextInfo(svg);

    // Extract leg information
    const legs = this.extractLegInfo(svg);

    // Extract colors (default to standard colors)
    const colors = this.extractColors();

    return {
      body,
      text,
      legs,
      colors
    };
  }

  private static extractAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  private static extractTextInfo(svg: Element): SvgLegoData["text"] {
    const text: SvgLegoData["text"] = {};

    // Look for short name text
    const shortNameElement = svg.querySelector('[data-role="short-name"]');
    if (shortNameElement) {
      text.shortName = {
        x: parseFloat(shortNameElement.getAttribute("x") || "0"),
        y: parseFloat(shortNameElement.getAttribute("y") || "0"),
        content: shortNameElement.textContent || ""
      };
    }

    // Look for instance ID text
    const instanceIdElement = svg.querySelector('[data-role="instance-id"]');
    if (instanceIdElement) {
      text.instanceId = {
        x: parseFloat(instanceIdElement.getAttribute("x") || "0"),
        y: parseFloat(instanceIdElement.getAttribute("y") || "0"),
        content: instanceIdElement.textContent || ""
      };
    }

    // Look for combined text
    const combinedElement = svg.querySelector('[data-role="combined-text"]');
    if (combinedElement) {
      text.combined = {
        x: parseFloat(combinedElement.getAttribute("x") || "0"),
        y: parseFloat(combinedElement.getAttribute("y") || "0"),
        content: combinedElement.textContent || ""
      };
    }

    return text;
  }

  private static extractLegInfo(svg: Element): SvgLegoData["legs"] {
    const legs: SvgLegoData["legs"] = [];
    const legEndpoints = svg.querySelectorAll('[data-role="leg-endpoint"]');

    legEndpoints.forEach((endpoint) => {
      const index = parseInt(endpoint.getAttribute("data-leg-index") || "0");
      const type =
        (endpoint.getAttribute("data-leg-type") as
          | "logical"
          | "gauge"
          | "physical") || "physical";

      // Look for corresponding leg line element
      const legLine = svg.querySelector(
        `[data-role="leg-line"][data-leg-index="${index}"]`
      );

      if (!legLine) {
        throw new Error(
          `Leg line element not found for leg index ${index} in ${svg.outerHTML}`
        );
      }

      // Calculate start position (usually center, but could be customized)
      const startX = parseFloat(legLine.getAttribute("x1") || "0");
      const startY = parseFloat(legLine.getAttribute("y1") || "0");

      // End position is the endpoint position
      const endX = parseFloat(legLine.getAttribute("x2") || "0");
      const endY = parseFloat(legLine.getAttribute("y2") || "0");

      // Calculate label position (15 units away from endpoint)
      const angle = Math.atan2(endY - startY, endX - startX);
      const labelDistance = 15;
      const labelX = endX + labelDistance * Math.cos(angle);
      const labelY = endY + labelDistance * Math.sin(angle);

      const lineElement = legLine ? legLine.outerHTML : undefined;

      const bodyOrder =
        (legLine.getAttribute("data-leg-body-order") as "front" | "behind") ||
        "behind";

      legs.push({
        index,
        type,
        startX,
        startY,
        endX,
        endY,
        labelX,
        labelY,
        lineStyle: "solid",
        width: "1px",
        startOffset: 0,
        lineElement,
        bodyOrder
      });
    });

    return legs.sort((a, b) => a.index - b.index);
  }

  private static extractColors(): SvgLegoData["colors"] {
    // Default colors - these could be extracted from SVG elements with data attributes
    return {
      background: "#FFFFFF",
      border: "#4299E1",
      selectedBackground: "#3182CE",
      selectedBorder: "#2B6CB0"
    };
  }

  static createLegStylesFromSvgData(svgData: SvgLegoData): LegStyle[] {
    return svgData.legs.map((leg) => {
      const position: LegPosition = {
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
        width: leg.width,
        lineStyle: leg.lineStyle,
        startOffset: leg.startOffset,
        color: getPauliColor(PauliOperator.I), // Default color, will be updated by highlighting logic
        is_highlighted: false,
        type: leg.type,
        position,
        bodyOrder: leg.bodyOrder
      };
    });
  }
}
