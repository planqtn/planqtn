import { Box, Text, VStack } from "@chakra-ui/react";
import { DroppedLego, TensorNetwork, LegDragState, DragState, Connection } from "../types";

// Add shared function for leg position calculations
export interface LegPosition {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    labelX: number;
    labelY: number;
    angle: number;
}

export function calculateLegPosition(lego: DroppedLego, legIndex: number, labelDistance: number = 15): LegPosition {
    const legStyle = lego.style.getLegStyle(legIndex, lego);

    // Calculate start position relative to center
    const startX = legStyle.from === "center" ? 0 :
        legStyle.from === "bottom" ? legStyle.startOffset * Math.cos(legStyle.angle) : 0;
    const startY = legStyle.from === "center" ? 0 :
        legStyle.from === "bottom" ? legStyle.startOffset * Math.sin(legStyle.angle) : 0;

    // Calculate end position
    const endX = startX + legStyle.length * Math.cos(legStyle.angle);
    const endY = startY + legStyle.length * Math.sin(legStyle.angle);

    // Calculate label position
    const labelX = endX + labelDistance * Math.cos(legStyle.angle);
    const labelY = endY + labelDistance * Math.sin(legStyle.angle);

    return { startX, startY, endX, endY, labelX, labelY, angle: legStyle.angle };
}

interface DroppedLegoDisplayProps {
    lego: DroppedLego;
    index: number;
    legDragState: LegDragState | null;
    handleLegMouseDown: (e: React.MouseEvent, legoId: string, legIndex: number) => void;
    handleLegoMouseDown: (e: React.MouseEvent, index: number) => void;
    handleLegoClick: (e: React.MouseEvent, lego: DroppedLego) => void;
    tensorNetwork: TensorNetwork | null;
    selectedLego: DroppedLego | null;
    manuallySelectedLegos: DroppedLego[] | null;
    dragState: DragState | null;
    onLegClick?: (legoId: string, legIndex: number) => void;
    hideConnectedLegs: boolean;
    connections: Connection[];
    droppedLegos?: DroppedLego[];
}

export const DroppedLegoDisplay: React.FC<DroppedLegoDisplayProps> = ({
    lego,
    index,
    legDragState,
    handleLegMouseDown,
    handleLegoMouseDown,
    handleLegoClick,
    tensorNetwork,
    selectedLego,
    manuallySelectedLegos,
    dragState,
    onLegClick,
    hideConnectedLegs,
    connections,
    droppedLegos = []
}) => {
    const size = lego.style.size;
    const totalLegs = lego.parity_check_matrix[0].length / 2; // Total number of legs (symplectic matrix, each column is X and Z)
    const numLogicalLegs = lego.logical_legs.length; // Number of logical legs
    const numGaugeLegs = lego.gauge_legs.length; // Number of gauge legs
    const numRegularLegs = totalLegs - numLogicalLegs - numGaugeLegs; // Regular legs are the remaining legs

    // Initialize selectedMatrixRows if not present
    if (!lego.selectedMatrixRows) {
        lego.selectedMatrixRows = [];
    }

    // Calculate polygon vertices - only for regular legs
    const vertices = Array.from({ length: numRegularLegs }, (_, i) => {
        // Start from the top (- Math.PI / 2) and go clockwise
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs;
        return {
            x: (size / 2) * Math.cos(angle) + size / 2,
            y: (size / 2) * Math.sin(angle) + size / 2
        };
    });

    const isSelected = tensorNetwork?.legos.some(l => l.instanceId === lego.instanceId) ||
        selectedLego?.instanceId === lego.instanceId ||
        manuallySelectedLegos?.some(l => l.instanceId === lego.instanceId);

    // Calculate leg positions once for both rendering and labels
    const legPositions = Array(totalLegs).fill(0).map((_, legIndex) => {
        const legStyle = lego.style.getLegStyle(legIndex, lego, true);
        const startX = legStyle.from === "center" ? 0 :
            legStyle.from === "bottom" ? legStyle.startOffset * Math.cos(legStyle.angle) : 0;
        const startY = legStyle.from === "center" ? 0 :
            legStyle.from === "bottom" ? legStyle.startOffset * Math.sin(legStyle.angle) : 0;
        const endX = startX + legStyle.length * Math.cos(legStyle.angle);
        const endY = startY + legStyle.length * Math.sin(legStyle.angle);
        const labelDistance = 15;
        const labelX = endX + labelDistance * Math.cos(legStyle.angle);
        const labelY = endY + labelDistance * Math.sin(legStyle.angle);

        return {
            startX,
            startY,
            endX,
            endY,
            labelX,
            labelY,
            angle: legStyle.angle,
            style: legStyle
        };
    });

    // Function to check if a leg is connected
    const isLegConnected = (legIndex: number) => {
        return connections.some(conn =>
            (conn.from.legoId === lego.instanceId && conn.from.legIndex === legIndex) ||
            (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex)
        );
    };


    // Function to determine if a leg should be hidden
    const shouldHideLeg = (legIndex: number) => {
        if (!hideConnectedLegs) return false;
        const isConnected = isLegConnected(legIndex);
        if (!isConnected) return false;

        const thisLegStyle = lego.style.getLegStyle(legIndex, lego);
        const isThisHighlighted = thisLegStyle.is_highlighted;

        // If this leg is not highlighted, hide it only if connected to a non-highlighted leg
        if (!isThisHighlighted) {
            // Check if connected to a highlighted leg
            return !connections.some(conn => {
                if (conn.from.legoId === lego.instanceId && conn.from.legIndex === legIndex) {
                    const connectedLego = droppedLegos?.find(l => l.instanceId === conn.to.legoId);
                    return connectedLego?.style.getLegStyle(conn.to.legIndex, connectedLego)?.is_highlighted || false;
                }
                if (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex) {
                    const connectedLego = droppedLegos?.find(l => l.instanceId === conn.from.legoId);
                    return connectedLego?.style.getLegStyle(conn.from.legIndex, connectedLego)?.is_highlighted || false;
                }
                return false;
            });
        }

        // If this leg is highlighted, hide it only if connected to a leg with the same highlight color
        return connections.some(conn => {
            if (conn.from.legoId === lego.instanceId && conn.from.legIndex === legIndex) {
                const connectedLego = droppedLegos?.find(l => l.instanceId === conn.to.legoId);
                const connectedStyle = connectedLego?.style.getLegStyle(conn.to.legIndex, connectedLego);
                return connectedStyle?.is_highlighted && connectedStyle.color === thisLegStyle.color;
            }
            if (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex) {
                const connectedLego = droppedLegos?.find(l => l.instanceId === conn.from.legoId);
                const connectedStyle = connectedLego?.style.getLegStyle(conn.from.legIndex, connectedLego);
                return connectedStyle?.is_highlighted && connectedStyle.color === thisLegStyle.color;
            }
            return false;
        });
    };

    // Function to get leg visibility style
    const getLegVisibility = (legIndex: number) => {
        if (shouldHideLeg(legIndex)) {
            return { visibility: 'hidden' as const, pointerEvents: 'none' as const };
        }
        return { visibility: 'visible' as const, pointerEvents: 'all' as const };
    };

    return (
        <Box
            position="absolute"
            left={`${lego.x}px`}
            top={`${lego.y}px`}
            cursor={dragState?.isDragging ? 'grabbing' : 'grab'}
            onMouseDown={(e) => handleLegoMouseDown(e, index)}
            onClick={(e) => handleLegoClick(e, lego)}
            style={{
                userSelect: 'none',
                zIndex: isSelected ? 1 : 0,
                opacity: dragState?.isDragging ? 0.5 : 1,
                transition: dragState?.isDragging ? 'none' : 'all 0.2s ease',
                filter: isSelected ? 'drop-shadow(0 0 4px rgba(66, 153, 225, 0.5))' : 'none',
                transform: 'translate(-50%, -50%)'
            }}
        >
            {/* Regular Legs (rendered with lower z-index) */}
            {legPositions.map((pos, legIndex) => {
                const isLogical = lego.logical_legs.includes(legIndex);
                if (isLogical) return null; // Skip logical legs in this pass

                const legColor = pos.style.color;
                const isBeingDragged = legDragState?.isDragging &&
                    legDragState.legoId === lego.instanceId &&
                    legDragState.legIndex === legIndex;

                const legVisibility = getLegVisibility(legIndex);
                return (
                    <Box
                        key={`leg-${legIndex}`}
                        position="absolute"
                        left="50%"
                        top="50%"
                        style={{
                            ...legVisibility,
                            zIndex: -1 // Place under the polygon
                        }}
                    >
                        {/* Line */}
                        <Box
                            position="absolute"
                            left={`${pos.startX}px`}
                            top={`${pos.startY}px`}
                            w={`${pos.style.length}px`}
                            h={legColor !== "#A0AEC0" ? "4px" : pos.style.width}
                            bg={legColor}
                            transformOrigin="0 0"
                            style={{
                                transform: `rotate(${pos.angle}rad)`,
                                borderStyle: pos.style.style
                            }}
                            transition="all 0.1s"
                        />
                        {/* Draggable Endpoint */}
                        <Box
                            position="absolute"
                            left={`${pos.endX}px`}
                            top={`${pos.endY}px`}
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg={isBeingDragged ? "blue.100" : "white"}
                            border="2px"
                            borderColor={isBeingDragged ? "blue.500" : legColor}
                            transform="translate(-50%, -50%)"
                            cursor="pointer"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                handleLegMouseDown(e, lego.instanceId, legIndex);
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onLegClick) {
                                    onLegClick(lego.instanceId, legIndex);
                                }
                            }}
                            _hover={{
                                borderColor: legColor,
                                bg: "white"
                            }}
                            transition="all 0.2s"
                        />
                    </Box>
                );
            })}

            {/* Lego Body */}
            {numRegularLegs <= 2 ? (
                <Box
                    w={`${size}px`}
                    h={`${size}px`}
                    borderRadius={lego.style.borderRadius}
                    bg={isSelected ? lego.style.selectedBackgroundColor : lego.style.backgroundColor}
                    border="2px"
                    borderColor={isSelected ? lego.style.selectedBorderColor : lego.style.borderColor}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    position="relative"
                    style={{ pointerEvents: 'all' }}
                >
                    {lego.style.displayShortName && (
                        <VStack spacing={0}>
                            <Text fontSize="12" fontWeight="bold">{lego.shortName}</Text>
                            <Text fontSize="12">{lego.instanceId}</Text>
                        </VStack>
                    )}
                    {!lego.style.displayShortName && (
                        <Text fontSize="12" fontWeight="bold">{lego.instanceId}</Text>
                    )}
                </Box>
            ) : (
                <svg
                    width={size}
                    height={size}
                    style={{ pointerEvents: 'all', position: 'relative', zIndex: 0 }}
                >
                    <g transform={`translate(${size / 2}, ${size / 2})`}>
                        <path
                            d={vertices.reduce((path, vertex, i) => {
                                const command = i === 0 ? 'M' : 'L';
                                const x = (size / 2) * Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs);
                                const y = (size / 2) * Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs);
                                return `${path} ${command} ${x} ${y}`;
                            }, '') + ' Z'}
                            fill={isSelected ? lego.style.getSelectedBackgroundColorForSvg() : lego.style.getBackgroundColorForSvg()}
                            stroke={isSelected ? lego.style.getSelectedBorderColorForSvg() : lego.style.getBorderColorForSvg()}
                            strokeWidth="2"
                        />
                        <text
                            x="0"
                            y={lego.logical_legs.length > 0 ? 5 : 0}
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#000000"
                            style={{ pointerEvents: 'none' }}
                        >
                            {lego.style.displayShortName && (
                                <>
                                    {lego.shortName}
                                    <tspan x="0" dy="12">{lego.instanceId}</tspan>
                                </>
                            )}
                            {!lego.style.displayShortName && lego.instanceId}
                        </text>
                    </g>
                </svg>
            )}

            {/* Logical Legs (rendered with higher z-index) */}
            {legPositions.map((pos, legIndex) => {
                const isLogical = lego.logical_legs.includes(legIndex);
                if (!isLogical) return null; // Skip regular legs in this pass

                const legColor = pos.style.color;
                const isBeingDragged = legDragState?.isDragging &&
                    legDragState.legoId === lego.instanceId &&
                    legDragState.legIndex === legIndex;

                return (
                    <Box
                        key={`leg-${legIndex}`}
                        position="absolute"
                        left="50%"
                        top="50%"
                        style={{
                            pointerEvents: 'none',
                            zIndex: 1 // Place above the polygon
                        }}
                    >
                        {/* Line */}
                        <Box
                            position="absolute"
                            left={`${pos.startX}px`}
                            top={`${pos.startY}px`}
                            w={`${pos.style.length}px`}
                            h={legColor !== "#A0AEC0" ? "4px" : pos.style.width}
                            bg={legColor}
                            transformOrigin="0 0"
                            style={{
                                transform: `rotate(${pos.angle}rad)`,
                                pointerEvents: isLogical ? 'all' : 'none',
                                borderStyle: pos.style.style
                            }}
                            cursor={isLogical ? "pointer" : "default"}
                            title={isLogical ? `Logical leg, ${lego.pushedLegs.find(pl => pl.legIndex === legIndex)?.operator || 'I'}` : undefined}
                            onClick={(e) => {
                                if (isLogical && onLegClick) {
                                    e.stopPropagation();
                                    onLegClick(lego.instanceId, legIndex);
                                }
                            }}
                            transition="all 0.1s"
                        />
                        {/* Draggable Endpoint */}
                        <Box
                            position="absolute"
                            left={`${pos.endX}px`}
                            top={`${pos.endY}px`}
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg={isBeingDragged ? "blue.100" : "white"}
                            border="2px"
                            borderColor={isBeingDragged ? "blue.500" : legColor}
                            transform="translate(-50%, -50%)"
                            cursor="pointer"
                            onMouseDown={(e) => {
                                e.stopPropagation();
                                handleLegMouseDown(e, lego.instanceId, legIndex);
                            }}
                            _hover={{
                                borderColor: legColor,
                                bg: "white"
                            }}
                            transition="all 0.2s"
                            style={{ pointerEvents: 'all' }}
                        />
                    </Box>
                );
            })}
        </Box>
    );
}