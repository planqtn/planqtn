import React from 'react';
import { Lego } from '../types/lego';

interface LegoPieceProps {
    lego: Lego & {
        x: number;
        y: number;
        logicalLegs: number[];
        physicalLegs: number[];
    };
    onClick: () => void;
    onLegToggle: (legIndex: number, isLogical: boolean) => void;
}

export const LegoPiece: React.FC<LegoPieceProps> = ({ lego, onClick, onLegToggle }) => {
    const getNumLegs = (lego: Lego) => {
        if (!lego.parity_check_matrix || lego.parity_check_matrix.length === 0) {
            return 0;
        }
        return lego.parity_check_matrix[0].length;
    };

    const numLegs = getNumLegs(lego);
    const legRadius = 6;
    const pieceRadius = 25;
    const legLength = 25;

    const getLegStyle = (index: number) => {
        const isLogical = lego.logicalLegs.includes(index);
        const isPhysical = lego.physicalLegs.includes(index);
        const strokeWidth = isLogical ? 3 : isPhysical ? 2 : 1;
        const strokeColor = isLogical ? '#4F46E5' : isPhysical ? '#10B981' : '#9CA3AF';
        return { strokeWidth, strokeColor };
    };

    return (
        <g
            transform={`translate(${lego.x}, ${lego.y})`}
            onClick={onClick}
            className="cursor-pointer transition-transform hover:scale-105"
        >
            {/* Main piece circle */}
            <circle
                cx={0}
                cy={0}
                r={pieceRadius}
                fill="#F9FAFB"
                stroke="#4B5563"
                strokeWidth={2}
                className="shadow-md"
            />

            {/* Legs */}
            {Array.from({ length: numLegs }).map((_, index) => {
                const angle = (2 * Math.PI * index) / numLegs;
                const startX = pieceRadius * Math.cos(angle);
                const startY = pieceRadius * Math.sin(angle);
                const endX = (pieceRadius + legLength) * Math.cos(angle);
                const endY = (pieceRadius + legLength) * Math.sin(angle);
                const { strokeWidth, strokeColor } = getLegStyle(index);

                return (
                    <g key={index}>
                        <line
                            x1={startX}
                            y1={startY}
                            x2={endX}
                            y2={endY}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            className="transition-colors"
                        />
                        <circle
                            cx={endX}
                            cy={endY}
                            r={legRadius}
                            fill="white"
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                            onClick={(e) => {
                                e.stopPropagation();
                                onLegToggle(index, !lego.logicalLegs.includes(index));
                            }}
                            className="cursor-pointer shadow-sm transition-colors hover:stroke-2"
                        />
                    </g>
                );
            })}
        </g>
    );
}; 