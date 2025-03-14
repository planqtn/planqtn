import { LegoPiece } from "./types";


interface LegStyle {
    angle: number;
    length: number;
    width: string;
    style: string;
    from: "center" | "bottom" | "edge";
    startOffset: number;
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

    get is_special(): boolean {
        return true;
    }

    getLegStyle(legIndex: number, lego: LegoPiece): LegStyle {
        const isLogical = lego.logical_legs.includes(legIndex);
        const isGauge = lego.gauge_legs.includes(legIndex);
        const legCount = lego.parity_check_matrix[0].length / 2;

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
                startOffset: 0 // No offset for logical legs
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
                startOffset: 10 // Offset from edge for gauge legs
            };
        } else {
            // Regular legs
            const angle = (2 * Math.PI * legIndex) / legCount;
            return {
                angle,
                length: 40,
                width: "2px",
                style: "solid",
                from: "edge",
                startOffset: 0 // No offset for regular legs
            };
        }
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
                return "white";
            case "stopper_x":
                return "red.200";
            case "stopper_z":
                return "green.200";
            default:
                return "gray.200";
        }
    }

    get borderColor(): string {
        switch (this.id) {
            case "stopper_i":
                return "gray.400";
            case "stopper_x":
                return "red.400";
            case "stopper_z":
                return "green.400";
            default:
                return "gray.400";
        }
    }

    get selectedBackgroundColor(): string {
        switch (this.id) {
            case "stopper_i":
                return "gray.200";
            case "stopper_x":
                return "red.300";
            case "stopper_z":
                return "green.300";
            default:
                return "gray.300";
        }
    }

    get selectedBorderColor(): string {
        switch (this.id) {
            case "stopper_i":
                return "gray.600";
            case "stopper_x":
                return "red.700";
            case "stopper_z":
                return "green.700";
            default:
                return "gray.700";
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

