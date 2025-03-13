import { Box, Text, Heading, Table, Thead, Tbody, Tr, Td } from '@chakra-ui/react'
import { LegoPiece, TensorNetworkLeg } from '../types.ts'
import { useState } from 'react'

interface ParityCheckMatrixDisplayProps {
    matrix: number[][]
    title?: string
    lego?: LegoPiece
    legOrdering?: TensorNetworkLeg[]
    onMatrixChange?: (newMatrix: number[][]) => void
}

export const ParityCheckMatrixDisplay: React.FC<ParityCheckMatrixDisplayProps> = ({
    matrix,
    title,
    lego,
    legOrdering,
    onMatrixChange
}) => {
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);

    if (!matrix || matrix.length === 0) return null;

    const getColumnStyle = (index: number) => {
        const legIndex = index % (matrix[0].length / 2);
        if (lego?.logical_legs.includes(legIndex)) {
            return { fontWeight: "bold", color: "blue.600" };
        }
        if (lego?.gauge_legs.includes(legIndex)) {
            return { fontWeight: "bold", color: "gray.700" };
        }
        return { color: "gray.600" };
    };

    const getLegIndices = () => {
        return Array(matrix[0].length / 2).fill(0).map((_, i) => i);
    }

    const numLegs = matrix[0].length / 2;
    const n_stabilizers = matrix.length;

    const handleDragStart = (e: React.DragEvent, rowIndex: number) => {
        setDraggedRowIndex(rowIndex);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetRowIndex: number) => {
        e.preventDefault();
        if (draggedRowIndex === null || draggedRowIndex === targetRowIndex) return;

        // Create a new matrix with the rows added
        const newMatrix = matrix.map((row, index) => {
            if (index === targetRowIndex) {
                // Add the dragged row to the target row (modulo 2)
                return row.map((cell, cellIndex) =>
                    (cell + matrix[draggedRowIndex][cellIndex]) % 2
                );
            }
            return row;
        });

        // Update the matrix through the callback
        if (onMatrixChange) {
            onMatrixChange(newMatrix);
        }

        setDraggedRowIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedRowIndex(null);
    };

    return (
        <Box>
            {title && <Heading size="sm" mb={2}>{title}</Heading>}
            <Text>[[{numLegs}, {numLegs - n_stabilizers}]]</Text>
            <Box overflowX="auto">
                <Table size="sm" variant="simple">
                    <Thead>
                        <Tr>
                            <>
                                <Td
                                    p={2}
                                    textAlign="center"
                                    borderWidth={0}
                                    colSpan={matrix[0].length / 2}
                                    fontWeight="bold"
                                    color="blue.600"
                                >
                                    X
                                </Td>
                                <Td
                                    p={2}
                                    textAlign="center"
                                    borderWidth={0}
                                    colSpan={matrix[0].length / 2}
                                    fontWeight="bold"
                                    color="red.600"
                                >
                                    Z
                                </Td>
                            </>
                        </Tr>
                        {legOrdering && (
                            <Tr>
                                <>
                                    {/* X lego indices */}
                                    {legOrdering?.map(leg => (
                                        <Td
                                            key={`x-legoidx-${leg.instanceId}-${leg.legIndex}`}
                                            p={2}
                                            textAlign="center"
                                            borderWidth={0}
                                            colSpan={1}
                                            fontSize="sm"
                                            color="blue.600"
                                        >
                                            {leg.instanceId}-{leg.legIndex}
                                        </Td>
                                    ))}
                                    {/* Z lego indices */}
                                    {legOrdering?.map(leg => (
                                        <Td
                                            key={`z-legoidx-${leg.instanceId}-${leg.legIndex}`}
                                            p={2}
                                            textAlign="center"
                                            borderWidth={0}
                                            colSpan={1}
                                            fontSize="sm"
                                            color="red.600"
                                        >
                                            {leg.instanceId}-{leg.legIndex}
                                        </Td>
                                    ))}
                                </>
                            </Tr>)
                            ||
                            <Tr>
                                {getLegIndices().map(leg => (
                                    <Td key={`x-idx-${leg}`} p={2} textAlign="center" borderWidth={0} colSpan={1} fontSize="sm" {...getColumnStyle(leg)}>
                                        {leg}
                                    </Td>
                                ))}
                                {getLegIndices().map(leg => (
                                    <Td key={`z-idx-${leg}`} p={2} textAlign="center" borderWidth={0} colSpan={1} fontSize="sm" {...getColumnStyle(leg)}>
                                        {leg}
                                    </Td>
                                ))}
                            </Tr>
                        }
                    </Thead>
                    <Tbody>
                        {matrix.map((row, rowIndex) => (
                            <Tr
                                key={rowIndex}
                                draggable
                                onDragStart={(e) => handleDragStart(e, rowIndex)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, rowIndex)}
                                onDragEnd={handleDragEnd}
                                cursor="move"
                                bg={draggedRowIndex === rowIndex ? "blue.50" : "transparent"}
                                _hover={{ bg: "gray.50" }}
                            >
                                {row.map((cell, cellIndex) => {
                                    const isMiddle = cellIndex === row.length / 2 - 1;
                                    return (
                                        <Td
                                            key={cellIndex}
                                            p={2}
                                            textAlign="center"
                                            bg={cell === 1 ? "blue.100" : "transparent"}
                                            borderWidth={1}
                                            borderColor="gray.200"
                                            borderRightWidth={isMiddle ? 3 : 1}
                                            borderRightColor={isMiddle ? "gray.400" : "gray.200"}
                                        >
                                            {cell}
                                        </Td>
                                    )
                                })}
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </Box>
        </Box>
    )
} 