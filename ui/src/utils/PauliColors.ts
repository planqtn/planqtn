import { PauliOperator } from "../types";

// Chakra UI color tokens
export const I_COLOR = "gray.400";
export const I_COLOR_LIGHT = "gray.200";
export const I_COLOR_DARK = "gray.600";

export const X_COLOR = "red.400";
export const X_COLOR_LIGHT = "red.200";
export const X_COLOR_DARK = "red.600";

export const Z_COLOR = "blue.400";
export const Z_COLOR_LIGHT = "blue.200";
export const Z_COLOR_DARK = "blue.600";

export const Y_COLOR = "purple.400";
export const Y_COLOR_LIGHT = "purple.200";
export const Y_COLOR_DARK = "purple.600";

// SVG hex colors
const SVG_COLORS = {
    I: "#A0AEC0",  // gray.400
    X: "#F56565",  // red.400
    Z: "#4299E1",  // blue.400
    Y: "#9F7AEA",  // purple.400
};

export function getPauliColor(operator: PauliOperator, forSvg: boolean = false): string {
    if (forSvg) {
        switch (operator) {
            case PauliOperator.X:
                return SVG_COLORS.X;
            case PauliOperator.Z:
                return SVG_COLORS.Z;
            case PauliOperator.Y:
                return SVG_COLORS.Y;
            default:
                return SVG_COLORS.I;
        }
    }

    switch (operator) {
        case PauliOperator.X:
            return X_COLOR;
        case PauliOperator.Z:
            return Z_COLOR;
        case PauliOperator.Y:
            return Y_COLOR;
        default:
            return I_COLOR;
    }
}