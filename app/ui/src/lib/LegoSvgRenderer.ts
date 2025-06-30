import { LegStyle } from "../LegoStyles";
import { DroppedLego, Connection } from "./types";

export interface LegoSvgOptions {
  demoMode?: boolean;
  isSelected?: boolean;
  hideConnectedLegs?: boolean;
  connections?: Connection[];
  droppedLegos?: DroppedLego[];
  showLabels?: boolean;
}

export class LegoSvgRenderer {
  static renderLegoAsSVG(
    lego: DroppedLego,
    options: LegoSvgOptions = {}
  ): string {
    const { demoMode = true, isSelected = false, showLabels = false } = options;

    const numLegs = lego.parity_check_matrix[0].length / 2;
    const size = lego.style!.size;
    const numRegularLegs = numLegs - lego.logical_legs.length;

    // Calculate leg positions
    const legStyles = lego.style!.legStyles;

    // Generate regular legs SVG
    const regularLegsSvg = legStyles
      .map((legStyle, index) => {
        const isLogical = lego.logical_legs.includes(index);
        if (isLogical) return "";

        const legColor = legStyle.color;
        return `
          <line x1="${legStyle.position.startX}" y1="${legStyle.position.startY}" x2="${legStyle.position.endX}" y2="${legStyle.position.endY}" 
                stroke="${legColor}" stroke-width="${legColor !== "#A0AEC0" ? 4 : parseInt(legStyle.width)}" 
                ${legStyle.lineStyle === "dashed" ? 'stroke-dasharray="5,5"' : ""} />
          <circle cx="${legStyle.position.endX}" cy="${legStyle.position.endY}" r="5" fill="white" stroke="${legColor}" stroke-width="2" />
        `;
      })
      .join("");

    // Generate main body SVG
    const mainBodySvg = this.generateMainBodySvg(
      lego,
      size,
      numRegularLegs,
      isSelected
    );

    // Generate logical legs SVG
    const logicalLegsSvg = legStyles
      .map((legStyle, legIndex) => {
        const isLogical = lego.logical_legs.includes(legIndex);
        if (!isLogical) return "";

        const legColor = legStyle.color;
        return `
          <line x1="${legStyle.position.startX}" y1="${legStyle.position.startY}" x2="${legStyle.position.endX}" y2="${legStyle.position.endY}" 
                stroke="${legColor}" stroke-width="${legColor !== "#A0AEC0" ? 4 : parseInt(legStyle.width)}" 
                ${legStyle.lineStyle === "dashed" ? 'stroke-dasharray="5,5"' : ""} />
          <circle cx="${legStyle.position.endX}" cy="${legStyle.position.endY}" r="5" fill="white" stroke="${legColor}" stroke-width="2" />
        `;
      })
      .join("");

    // Generate labels if needed
    const labelsSvg =
      showLabels && !demoMode
        ? this.generateLabelsSvg(lego, legStyles, options)
        : "";

    // Generate text labels for the lego body
    const textSvg = this.generateTextSvg(lego, size, demoMode, isSelected);

    // Combine all SVG parts
    return `
      <g transform="translate(${size / 2}, ${size / 2})">
        ${regularLegsSvg}
        ${mainBodySvg}
        ${textSvg}
        ${logicalLegsSvg}
        ${labelsSvg}
      </g>
    `;
  }

  private static generateMainBodySvg(
    lego: DroppedLego,
    size: number,
    numRegularLegs: number,
    isSelected: boolean
  ): string {
    if (numRegularLegs <= 2) {
      const borderRadius =
        typeof lego.style!.borderRadius === "string" &&
        lego.style!.borderRadius === "full"
          ? size / 2
          : typeof lego.style!.borderRadius === "number"
            ? lego.style!.borderRadius
            : 0;

      return `
        <g transform="translate(-${size / 2}, -${size / 2})">
          <rect x="0" y="0" width="${size}" height="${size}" 
                rx="${borderRadius}" ry="${borderRadius}"
                fill="${isSelected ? lego.style!.getSelectedBackgroundColorForSvg() : lego.style!.getBackgroundColorForSvg()}" 
                stroke="${isSelected ? lego.style!.getSelectedBorderColorForSvg() : lego.style!.getBorderColorForSvg()}" 
                stroke-width="2" />
        </g>
      `;
    } else {
      if (numRegularLegs > 8) {
        return `
          <circle cx="0" cy="0" r="${size / 2}" 
                  fill="${isSelected ? lego.style!.getSelectedBackgroundColorForSvg() : lego.style!.getBackgroundColorForSvg()}" 
                  stroke="${isSelected ? lego.style!.getSelectedBorderColorForSvg() : lego.style!.getBorderColorForSvg()}" 
                  stroke-width="2" />
        `;
      } else {
        const pathData =
          Array.from({ length: numRegularLegs }, (_, i) => {
            const command = i === 0 ? "M" : "L";
            const x =
              (size / 2) *
              Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs);
            const y =
              (size / 2) *
              Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs);
            return `${command} ${x} ${y}`;
          }).join(" ") + " Z";

        return `
          <path d="${pathData}" 
                fill="${isSelected ? lego.style!.getSelectedBackgroundColorForSvg() : lego.style!.getBackgroundColorForSvg()}" 
                stroke="${isSelected ? lego.style!.getSelectedBorderColorForSvg() : lego.style!.getBorderColorForSvg()}" 
                stroke-width="2" />
        `;
      }
    }
  }

  private static generateTextSvg(
    lego: DroppedLego,
    size: number,
    demoMode: boolean,
    isSelected: boolean
  ): string {
    if (demoMode) return "";

    const numRegularLegs =
      lego.parity_check_matrix[0].length / 2 - lego.logical_legs.length;
    const textColor = isSelected ? "white" : "#000000";

    if (numRegularLegs <= 2) {
      if (lego.style!.displayShortName) {
        return `
          <g transform="translate(-${size / 2}, -${size / 2})">
            <text x="${size / 2}" y="${size / 2 - 6}" font-size="12" font-weight="bold" 
                  text-anchor="middle" dominant-baseline="middle" fill="${textColor}">
              ${lego.shortName}
            </text>
            <text x="${size / 2}" y="${size / 2 + 6}" font-size="12" 
                  text-anchor="middle" dominant-baseline="middle" fill="${textColor}">
              ${lego.instanceId}
            </text>
          </g>
        `;
      } else {
        return `
          <g transform="translate(-${size / 2}, -${size / 2})">
            <text x="${size / 2}" y="${size / 2}" font-size="12" font-weight="bold" 
                  text-anchor="middle" dominant-baseline="middle" fill="${textColor}">
              ${lego.instanceId}
            </text>
          </g>
        `;
      }
    } else {
      const yOffset = lego.logical_legs.length > 0 ? 5 : 0;
      if (lego.style!.displayShortName) {
        return `
          <text x="0" y="${yOffset}" font-size="10" font-weight="bold" 
                text-anchor="middle" dominant-baseline="middle" fill="${textColor}">
            ${lego.shortName}
            <tspan x="0" dy="12">${lego.instanceId}</tspan>
          </text>
        `;
      } else {
        return `
          <text x="0" y="${yOffset}" font-size="10" font-weight="bold" 
                text-anchor="middle" dominant-baseline="middle" fill="${textColor}">
            ${lego.instanceId}
          </text>
        `;
      }
    }
  }

  private static generateLabelsSvg(
    lego: DroppedLego,
    legStyles: LegStyle[],
    options: LegoSvgOptions
  ): string {
    const { connections = [], hideConnectedLegs = false } = options;

    // This is a simplified version - you might want to port the full logic from DroppedLegoDisplay
    return legStyles
      .map((legStyle, legIndex) => {
        // Check if leg is connected
        const isLegConnected = connections.some(
          (c: Connection) =>
            (c.from.legoId === lego.instanceId &&
              c.from.legIndex === legIndex) ||
            (c.to.legoId === lego.instanceId && c.to.legIndex === legIndex)
        );

        // Simple logic: show label if not connected or if not hiding connected legs
        if (!isLegConnected || !hideConnectedLegs) {
          return `
            <text x="${legStyle.position.labelX}" y="${legStyle.position.labelY}" font-size="12" fill="#666666" 
                  text-anchor="middle" dominant-baseline="middle">
              ${legIndex}
            </text>
          `;
        }
        return "";
      })
      .join("");
  }
}
