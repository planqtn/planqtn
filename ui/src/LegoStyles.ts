import { DroppedLego, LegoPiece, PauliOperator } from "./types";
import { getPauliColor, I_COLOR, I_COLOR_DARK, I_COLOR_LIGHT, X_COLOR, X_COLOR_DARK, X_COLOR_LIGHT, Y_COLOR, Z_COLOR, Z_COLOR_DARK, Z_COLOR_LIGHT } from "./utils/PauliColors";

// Color mapping for SVG elements
const chakraToHexColors: { [key: string]: string } = {
    "white": "#FFFFFF",
    "yellow.200": "#FBD38D",
    "yellow.400": "#F6AD55",
    "yellow.500": "#ECC94B",
    "yellow.600": "#D69E2E",
    "blue.100": "#BEE3F8",
    "blue.400": "#4299E1",
    "blue.500": "#3182CE",
    "green.200": "#9AE6B4",
    "green.300": "#68D391",
    "green.400": "#48BB78",
    "green.700": "#2F855A",
    "red.200": "#FEB2B2",
    "red.300": "#FC8181",
    "red.400": "#F56565",
    "red.700": "#C53030"
};

interface LegStyle {
    angle: number;
    length: number;
    width: string;
    style: string;
    from: "center" | "bottom" | "edge";
    startOffset: number;
    color: string;
    is_highlighted: boolean;
}

export abstract class LegoStyle {
    constructor(protected readonly id: string) {

    }

    get displayShortName(): boolean {
        return true;
    }

    abstract get size(): number;
    abstract get borderRadius(): string;
    abstract get backgroundColor(): string;
    abstract get borderColor(): string;
    abstract get selectedBackgroundColor(): string;
    abstract get selectedBorderColor(): string;

    // New methods for SVG colors
    getBackgroundColorForSvg(): string {
        return chakraToHexColors[this.backgroundColor] || this.backgroundColor;
    }

    getBorderColorForSvg(): string {
        return chakraToHexColors[this.borderColor] || this.borderColor;
    }

    getSelectedBackgroundColorForSvg(): string {
        return chakraToHexColors[this.selectedBackgroundColor] || this.selectedBackgroundColor;
    }

    getSelectedBorderColorForSvg(): string {
        return chakraToHexColors[this.selectedBorderColor] || this.selectedBorderColor;
    }

    get is_special(): boolean {
        return true;
    }

    getLegHighlightPauliOperator = (legIndex: number, lego: DroppedLego) => {
        // First check if there's a pushed leg
        const pushedLeg = lego.pushedLegs.find(pl => pl.legIndex === legIndex);
        if (pushedLeg) {
            return pushedLeg.operator;
        }

        if (lego.selectedMatrixRows === undefined) {
            return PauliOperator.I;
        }

        const combinedRow = new Array(lego.parity_check_matrix[0].length).fill(0);

        for (const rowIndex of lego.selectedMatrixRows) {
            lego.parity_check_matrix[rowIndex].forEach((val, idx) => {
                combinedRow[idx] = (combinedRow[idx] + val) % 2;
            });
        }

        const xPart = combinedRow[legIndex];
        const zPart = combinedRow[legIndex + lego.parity_check_matrix[0].length / 2];

        if (xPart === 1 && zPart === 0) return PauliOperator.X;
        if (xPart === 0 && zPart === 1) return PauliOperator.Z;
        if (xPart === 1 && zPart === 1) return PauliOperator.Y;

        return PauliOperator.I;

        // // If no pushed leg, combine base representatives from all pushed legs
        // if (lego.pushedLegs.length > 0) {
        //     // Initialize combined base representative
        //     const combinedBase = new Array(lego.parity_check_matrix[0].length).fill(0);

        //     // Combine all pushed legs' base representatives mod 2
        //     lego.pushedLegs.forEach(pl => {
        //         pl.baseRepresentatitve.forEach((val, idx) => {
        //             combinedBase[idx] = (combinedBase[idx] + val) % 2;
        //         });
        //     });
        //     // Get the operator from the combined base representative
        //     const xPart = combinedBase[legIndex];
        //     const zPart = combinedBase[legIndex + lego.parity_check_matrix[0].length / 2];

        //     if (xPart === 1 && zPart === 0) return PauliOperator.X;
        //     if (xPart === 0 && zPart === 1) return PauliOperator.Z;
        //     if (xPart === 1 && zPart === 1) return PauliOperator.Y;
        // }
        // return PauliOperator.I;
    };



    getLegStyle(legIndex: number, lego: DroppedLego, forSvg: boolean = false): LegStyle {
        const isLogical = lego.logical_legs.includes(legIndex);
        const isGauge = lego.gauge_legs.includes(legIndex);
        const legCount = lego.parity_check_matrix[0].length / 2;
        const highlightPauliOperator = this.getLegHighlightPauliOperator(legIndex, lego);
        const isHighlighted = highlightPauliOperator !== PauliOperator.I;
        if (isLogical) {
            // For logical legs, calculate angle from center upwards
            const logicalLegsCount = lego.logical_legs.length;
            const logicalIndex = lego.logical_legs.indexOf(legIndex);
            let angle;
            if (logicalLegsCount === 1) {
                angle = -Math.PI / 2; // Straight up
            } else {
                const spread = Math.PI / 3; // 60 degree spread
                const startAngle = -Math.PI / 2 - (spread / 2);
                angle = startAngle + (spread * logicalIndex / (logicalLegsCount - 1));
            }
            return {
                angle,
                length: 50, // Longer than normal legs
                width: "3px", // Thicker line
                style: "solid",
                from: "center", // Start from center
                startOffset: 0, // No offset for logical legs
                color: forSvg ? getPauliColor(highlightPauliOperator, true) : getPauliColor(highlightPauliOperator),
                is_highlighted: isHighlighted
            };
        } else if (isGauge) {
            // For gauge legs, calculate angle from bottom
            const angle = Math.PI + ((2 * Math.PI * legIndex) / legCount);
            return {
                angle,
                length: 40,
                width: "2px",
                style: "dashed",
                from: "bottom",
                startOffset: 10, // Offset from edge for gauge legs
                color: forSvg ? getPauliColor(highlightPauliOperator, true) : getPauliColor(highlightPauliOperator),
                is_highlighted: isHighlighted
            };
        } else {
            // Regular legs
            const angle = (2 * Math.PI * legIndex) / legCount;
            return {
                angle,
                length: 40,
                width: highlightPauliOperator === PauliOperator.I ? "1px" : "3px",
                style: "solid",
                from: "edge",
                startOffset: 0, // No offset for regular legs
                color: forSvg ? getPauliColor(highlightPauliOperator, true) : getPauliColor(highlightPauliOperator),
                is_highlighted: isHighlighted
            };
        }
    }

    getLegColor(legIndex: number, lego: DroppedLego, forSvg: boolean = false): string {
        const legStyle = this.getLegStyle(legIndex, lego, forSvg);
        return legStyle.color;
    }
}

export class HadamardStyle extends LegoStyle {
    get size(): number {
        return 20;
    }

    get borderRadius(): string {
        return "0";
    }

    get backgroundColor(): string {
        return "yellow.200";
    }

    get borderColor(): string {
        return "yellow.400";
    }

    get selectedBackgroundColor(): string {
        return "yellow.500";
    }

    get selectedBorderColor(): string {
        return "yellow.600";
    }

    get displayShortName(): boolean {
        return false;
    }
}

export class GenericStyle extends LegoStyle {
    get size(): number {
        return 50;
    }

    get borderRadius(): string {
        return "full";
    }

    get backgroundColor(): string {
        return "white";
    }

    get borderColor(): string {
        return "blue.400";
    }

    get selectedBackgroundColor(): string {
        return "blue.100";
    }

    get selectedBorderColor(): string {
        return "blue.500";
    }

    get is_special(): boolean {
        return false;
    }
}

export class RepetitionCodeStyle extends LegoStyle {
    get size(): number {
        return 20;
    }

    get borderRadius(): string {
        return "full";
    }

    get backgroundColor(): string {
        return this.id === "z_rep_code" ? "green.200" : "red.200";
    }

    get borderColor(): string {
        return this.id === "z_rep_code" ? "green.400" : "red.400";
    }

    get selectedBackgroundColor(): string {
        return this.id === "z_rep_code" ? "green.300" : "red.300";
    }

    get selectedBorderColor(): string {
        return this.id === "z_rep_code" ? "green.700" : "red.700";
    }

    get is_special(): boolean {
        return false;
    }

    get displayShortName(): boolean {
        return false;
    }

}

export class StopperStyle extends LegoStyle {
    get size(): number {
        return 20;
    }
    get borderRadius(): string {
        return "full";
    }

    get backgroundColor(): string {
        switch (this.id) {
            case "stopper_i":
                return I_COLOR_LIGHT;
            case "stopper_x":
                return X_COLOR_LIGHT;
            case "stopper_z":
                return Z_COLOR_LIGHT;
            default:
                return I_COLOR_LIGHT;
        }
    }

    get borderColor(): string {
        switch (this.id) {
            case "stopper_i":
                return I_COLOR;
            case "stopper_x":
                return X_COLOR;
            case "stopper_z":
                return Z_COLOR;
            default:
                return I_COLOR;
        }
    }

    get selectedBackgroundColor(): string {
        switch (this.id) {
            case "stopper_i":
                return I_COLOR_DARK;
            case "stopper_x":
                return X_COLOR_DARK;
            case "stopper_z":
                return Z_COLOR_DARK;
            default:
                return I_COLOR_DARK;
        }
    }

    get selectedBorderColor(): string {
        switch (this.id) {
            case "stopper_i":
                return I_COLOR_DARK;
            case "stopper_x":
                return X_COLOR_DARK;
            case "stopper_z":
                return Z_COLOR_DARK;
            default:
                return I_COLOR_DARK;
        }
    }

    get is_special(): boolean {
        return false;
    }

    get displayShortName(): boolean {
        return false;
    }

}
export function getLegoStyle(id: string): LegoStyle {
    if (id === "h") {
        return new HadamardStyle(id);
    } else if (id === "z_rep_code") {
        return new RepetitionCodeStyle(id);
    } else if (id === "x_rep_code") {
        return new RepetitionCodeStyle(id);
    } else if (id === "stopper_i") {
        return new StopperStyle(id);
    } else if (id === "stopper_x") {
        return new StopperStyle(id);
    } else if (id === "stopper_z") {
        return new StopperStyle(id);
    } else if (id === "stopper_y") {
        return new StopperStyle(id);
    } else {
        return new GenericStyle(id);
    }
}

