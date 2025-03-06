import React, { useState, useRef, useEffect } from 'react';
import { LegoPiece } from './LegoPiece';
import { LegoDetails } from './LegoDetails';
import { Lego } from '../types/lego';

interface CanvasProps {
    legos: Lego[];
}

interface LegoOnCanvas extends Lego {
    x: number;
    y: number;
    logicalLegs: number[];
    physicalLegs: number[];
}

export const Canvas: React.FC<CanvasProps> = ({ legos }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const [canvasLegos, setCanvasLegos] = useState<LegoOnCanvas[]>([]);
    const [selectedLego, setSelectedLego] = useState<LegoOnCanvas | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleDragStart = (e: React.DragEvent, lego: Lego) => {
        setIsDragging(true);
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const legoId = e.dataTransfer.getData('text/plain');
        const lego = legos.find(l => l.id === legoId);

        if (lego) {
            const newLego: LegoOnCanvas = {
                ...lego,
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                logicalLegs: [],
                physicalLegs: []
            };
            setCanvasLegos(prev => [...prev, newLego]);
        }
    };

    const handleLegoClick = (lego: LegoOnCanvas) => {
        setSelectedLego(lego);
    };

    const handleLegToggle = (legoId: string, legIndex: number, isLogical: boolean) => {
        setCanvasLegos(prev => prev.map(lego => {
            if (lego.id === legoId) {
                const newLego = { ...lego };
                if (isLogical) {
                    newLego.logicalLegs = lego.logicalLegs.includes(legIndex)
                        ? lego.logicalLegs.filter(i => i !== legIndex)
                        : [...lego.logicalLegs, legIndex];
                    newLego.physicalLegs = lego.physicalLegs.filter(i => i !== legIndex);
                } else {
                    newLego.physicalLegs = lego.physicalLegs.includes(legIndex)
                        ? lego.physicalLegs.filter(i => i !== legIndex)
                        : [...lego.physicalLegs, legIndex];
                    newLego.logicalLegs = lego.logicalLegs.filter(i => i !== legIndex);
                }
                return newLego;
            }
            return lego;
        }));
    };

    return (
        <div className="h-full flex">
            {/* Canvas area */}
            <div
                ref={canvasRef}
                className="flex-1 bg-gray-50 relative overflow-hidden"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Grid background */}
                <svg className="absolute inset-0 w-full h-full" style={{ opacity: 0.2 }}>
                    <defs>
                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#4B5563" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>

                {/* Lego pieces */}
                <svg className="absolute inset-0 w-full h-full">
                    {canvasLegos.map(lego => (
                        <LegoPiece
                            key={lego.id}
                            lego={lego}
                            onClick={() => handleLegoClick(lego)}
                            onLegToggle={(legIndex, isLogical) => handleLegToggle(lego.id, legIndex, isLogical)}
                        />
                    ))}
                </svg>
            </div>

            {/* Details panel */}
            {selectedLego && (
                <div className="border-l border-gray-200">
                    <LegoDetails
                        lego={selectedLego}
                        onClose={() => setSelectedLego(null)}
                        onLegToggle={(legIndex, isLogical) => handleLegToggle(selectedLego.id, legIndex, isLogical)}
                    />
                </div>
            )}
        </div>
    );
}; 