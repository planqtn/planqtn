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
    onLegClick?: (legoId: string, legIndex: number) => void;
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
    onLegClick
}) => {


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
                const legStyle = lego.style.getLegStyle(legIndex, lego);
                const isLogical = lego.logical_legs.includes(legIndex);
                const legColor = legStyle.color

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
                            h={legColor !== "gray.400" ? "4px" : legStyle.width}
                            bg={legColor}
                            transformOrigin="0 0"
                            style={{
                                transform: `rotate(${legStyle.angle}rad)`,
                                pointerEvents: isLogical ? 'all' : 'none',
                                borderStyle: legStyle.style
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
                            left={`${endX}px`}
                            top={`${endY}px`}
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