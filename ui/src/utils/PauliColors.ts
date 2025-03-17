import { PauliOperator } from "../types";

// Color constants for X and Z operations
export const X_COLOR = 'blue.500';
export const Z_COLOR = 'red.500';
export const X_COLOR_LIGHT = 'blue.100';
export const Z_COLOR_LIGHT = 'red.100';
export const X_COLOR_DARK = 'blue.600';
export const Z_COLOR_DARK = 'red.600';
export const Y_COLOR = 'purple.500';
export const I_COLOR = 'gray.400';
export const I_COLOR_DARK = 'gray.600';
export const I_COLOR_LIGHT = 'gray.200';
export function getPauliColor(operator: PauliOperator) {
    switch (operator) {
        case PauliOperator.X: return X_COLOR;
        case PauliOperator.Z: return Z_COLOR;
        case PauliOperator.Y: return Y_COLOR;
        case PauliOperator.I: return I_COLOR;
    }
}