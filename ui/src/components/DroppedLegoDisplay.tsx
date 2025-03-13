import { Box, Text } from "@chakra-ui/react";
import { DroppedLego, TensorNetwork, LegDragState, DragState } from "../types";

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
}

export const DroppedLegoDisplay: React.FC<DroppedLegoDisplayProps> = ({ lego, index, legDragState, handleLegMouseDown, handleLegoMouseDown, handleLegoClick, tensorNetwork, selectedLego, manuallySelectedLegos, dragState }) => {
    return (
        <Box
            key={`${lego.instanceId}`}
            position="absolute"
            left={`${lego.x - (lego.style.size / 2)}px`}
            top={`${lego.y - (lego.style.size / 2)}px`}
            style={{ userSelect: 'none' }}
        >
            {/* All Legs (rendered with z-index) */}
            {Array(lego.parity_check_matrix[0].length / 2).fill(0).map((_, legIndex) => {
                const legStyle = lego.style.getLegStyle(legIndex);
                const isLogical = lego.logical_legs.includes(legIndex);

                const startX = legStyle.from === "center" ? (lego.style.size / 2) :
                    legStyle.from === "bottom" ? (lego.style.size / 2) + legStyle.startOffset * Math.cos(legStyle.angle) : (lego.style.size / 2);
                const startY = legStyle.from === "center" ? (lego.style.size / 2) :
                    legStyle.from === "bottom" ? (lego.style.size / 2) + legStyle.startOffset * Math.sin(legStyle.angle) : (lego.style.size / 2);
                const endX = startX + legStyle.length * Math.cos(legStyle.angle);
                const endY = startY + legStyle.length * Math.sin(legStyle.angle);

                const isBeingDragged = legDragState?.isDragging &&
                    legDragState.legoId === lego.instanceId &&
                    legDragState.legIndex === legIndex;

                return (
                    <Box
                        key={`leg-${legIndex}`}
                        position="absolute"
                        style={{
                            pointerEvents: 'none',
                            zIndex: isLogical ? 1 : 0  // Set z-index based on leg type
                        }}
                    >
                        {/* Line */}
                        <Box
                            position="absolute"
                            left={`${startX}px`}
                            top={`${startY}px`}
                            w={`${legStyle.length}px`}
                            h={legStyle.width}
                            bg={isLogical ? "blue.500" : "gray.400"}
                            transformOrigin="0 0"
                            style={{
                                transform: `rotate(${legStyle.angle}rad)`,
                                pointerEvents: 'none',
                                borderStyle: legStyle.style
                            }}
                        />
                        {/* Draggable Endpoint */}
                        <Box
                            position="absolute"
                            left={`${endX}px`}
                            top={`${endY}px`}
                            w="10px"
                            h="10px"
                            borderRadius="full"
                            bg={isBeingDragged ? "blue.100" : "white"}
                            border="2px"
                            borderColor={isBeingDragged ? "blue.500" : (isLogical ? "blue.400" : "gray.400")}
                            transform="translate(-50%, -50%)"
                            cursor="pointer"
                            onMouseDown={(e) => handleLegMouseDown(e, lego.instanceId, legIndex)}
                            _hover={{ borderColor: "blue.400", bg: "blue.50" }}
                            transition="all 0.2s"
                            style={{ pointerEvents: 'all' }}
                        />
                    </Box>
                );
            })}

            <Box
                w={`${lego.style.size}px`}
                h={`${lego.style.size}px`}
                borderRadius={lego.style.borderRadius}
                bg={
                    tensorNetwork?.legos.some(l => l.instanceId === lego.instanceId) || selectedLego?.instanceId === lego.instanceId || manuallySelectedLegos?.some(l => l.instanceId === lego.instanceId)
                        ? lego.style.selectedBackgroundColor
                        : lego.style.backgroundColor
                }
                border="2px"
                borderColor={
                    tensorNetwork?.legos.some(l => l.instanceId === lego.instanceId) || selectedLego?.instanceId === lego.instanceId || manuallySelectedLegos?.some(l => l.instanceId === lego.instanceId)
                        ? lego.style.selectedBorderColor
                        : lego.style.borderColor
                }
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor={dragState?.isDragging && dragState.draggedLegoIndex === index ? "grabbing" : "grab"}
                title={lego.name}
                boxShadow="md"
                _hover={{ boxShadow: "lg" }}
                onMouseDown={(e) => handleLegoMouseDown(e, index)}
                onClick={(e) => handleLegoClick(e, lego)}
                style={{
                    transform: dragState?.isDragging && dragState.draggedLegoIndex === index
                        ? 'scale(1.05)'
                        : 'scale(1)',
                    transition: 'transform 0.1s',
                    userSelect: 'none',
                    touchAction: 'none'
                }}
                position="relative"
                zIndex={0}  // Set circle to z-index 0
            >
                <Box
                    style={{
                        pointerEvents: 'none',
                        userSelect: 'none',
                        transform: lego.logical_legs.length > 0 ? 'translateY(8px)' : 'none'
                    }}
                >
                    <Text fontSize="xs" fontWeight="bold" noOfLines={2} textAlign="center">
                        {lego.style.displayShortName &&
                            <>
                                {lego.shortName}
                                <br />
                            </>
                        }
                        {lego.instanceId}
                    </Text>

                </Box>
            </Box>
        </Box>)
}