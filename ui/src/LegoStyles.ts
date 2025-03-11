
export interface LegoPiece {
    id: string;
    name: string;
    shortName: string;
    type: string;
    description: string;
    is_dynamic?: boolean;
    parameters?: Record<string, any>;
    parity_check_matrix: number[][];
    logical_legs: number[];
    gauge_legs: number[];
}

interface LegStyle {
    angle: number;
    length: number;
    width: string;
    style: string;
    from: "center" | "bottom" | "edge";
    startOffset: number;
}

export abstract class LegoStyle {
    protected readonly lego: LegoPiece;

    constructor(lego: LegoPiece) {
        this.lego = lego;
    }

    get id(): string {
        return this.lego.id;
    }

    get name(): string {
        return this.lego.name;
    }

    get shortName(): string {
        return this.lego.shortName;
    }

    get description(): string {
        return this.lego.description;
    }

    get parity_check_matrix(): number[][] {
        return this.lego.parity_check_matrix;
    }

    get logical_legs(): number[] {
        return this.lego.logical_legs;
    }

    get gauge_legs(): number[] {
        return this.lego.gauge_legs;
    }

    abstract get size(): number;
    abstract get borderRadius(): string;
    abstract get backgroundColor(): string;
    abstract get borderColor(): string;
    abstract get selectedBackgroundColor(): string;
    abstract get selectedBorderColor(): string;

    getLegStyle(legIndex: number): LegStyle {
        const isLogical = this.logical_legs.includes(legIndex);
        const isGauge = this.gauge_legs.includes(legIndex);
        const legCount = this.parity_check_matrix[0].length / 2;

        if (isLogical) {
            // For logical legs, calculate angle from center upwards
            const logicalLegsCount = this.logical_legs.length;
            const logicalIndex = this.logical_legs.indexOf(legIndex);
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
}

export function getLegoStyle(lego: LegoPiece): LegoStyle {
    if (lego.id === "h") {
        return new HadamardStyle(lego);
    }
    return new GenericStyle(lego);
}


