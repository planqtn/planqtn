import { Box, Text, Heading, Table, Thead, Tbody, Tr, Td, Button, HStack, VStack, Grid } from '@chakra-ui/react'
import { LegoPiece, TensorNetworkLeg } from '../types.ts'
import { useState, useEffect, useRef } from 'react'
import { FaUndo, FaRedo, FaSync } from 'react-icons/fa'
import { StabilizerGraphView } from './StabilizerGraphView'

interface ParityCheckMatrixDisplayProps {
    matrix: number[][]
    title?: string
    lego?: LegoPiece
    legOrdering?: TensorNetworkLeg[]
    onMatrixChange?: (newMatrix: number[][]) => void
    onRecalculate?: () => void
}

export const ParityCheckMatrixDisplay: React.FC<ParityCheckMatrixDisplayProps> = ({
    matrix,
    title,
    lego,
    legOrdering,
    onMatrixChange,
    onRecalculate
}) => {
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
    const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null);
    const [matrixHistory, setMatrixHistory] = useState<number[][][]>([]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
    const hasInitialized = useRef(false);

    // Initialize history only once when component mounts
    useEffect(() => {
        if (!hasInitialized.current) {
            setMatrixHistory([matrix]);
            setCurrentHistoryIndex(0);
            hasInitialized.current = true;
        }
    }, []); // Empty dependency array means this only runs on mount

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

        // Update history
        const newHistory = [...matrixHistory.slice(0, currentHistoryIndex + 1), newMatrix];
        setMatrixHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);

        // Update the matrix through the callback
        if (onMatrixChange) {
            onMatrixChange(newMatrix);
        }

        setDraggedRowIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedRowIndex(null);
    };

    const handleUndo = () => {
        if (currentHistoryIndex > 0) {
            const newIndex = currentHistoryIndex - 1;
            setCurrentHistoryIndex(newIndex);
            if (onMatrixChange) {
                onMatrixChange(matrixHistory[newIndex]);
            }
        }
    };

    const handleRedo = () => {
        if (currentHistoryIndex < matrixHistory.length - 1) {
            const newIndex = currentHistoryIndex + 1;
            setCurrentHistoryIndex(newIndex);
            if (onMatrixChange) {
                onMatrixChange(matrixHistory[newIndex]);
            }
        }
    };

    const getPauliString = (row: number[]): string => {
        const n = row.length / 2;
        let result = '';
        for (let i = 0; i < n; i++) {
            const x = row[i];
            const z = row[i + n];
            if (x === 0 && z === 0) result += '_';
            else if (x === 1 && z === 0) result += 'X';
            else if (x === 0 && z === 1) result += 'Z';
            else if (x === 1 && z === 1) result += 'Y';
        }
        return result;
    };

    const getPauliColor = (pauli: string): string => {
        switch (pauli) {
            case 'X': return 'red.500';
            case 'Z': return 'green.500';
            case 'Y': return 'purple.500';
            default: return 'black';
        }
    };

    const isCSS = (row: number[]): boolean => {
        const n = row.length / 2;
        // Check if the row has only X or only Z components
        const hasX = row.slice(0, n).some(x => x === 1);
        const hasZ = row.slice(n).some(z => z === 1);
        return (hasX && !hasZ) || (!hasX && hasZ);
    };

    const handleCSSSort = () => {
        // Create a new matrix with rows sorted by CSS type
        const newMatrix = [...matrix].sort((a, b) => {
            const n = a.length / 2;
            const aHasX = a.slice(0, n).some(x => x === 1);
            const aHasZ = a.slice(n).some(z => z === 1);
            const bHasX = b.slice(0, n).some(x => x === 1);
            const bHasZ = b.slice(n).some(z => z === 1);

            // X-only rows come first
            if (aHasX && !aHasZ && (!bHasX || bHasZ)) return -1;
            if (bHasX && !bHasZ && (!aHasX || aHasZ)) return 1;

            // Z-only rows come second
            if (!aHasX && aHasZ && (bHasX || !bHasZ)) return -1;
            if (!bHasX && bHasZ && (aHasX || !aHasZ)) return 1;

            return 0;
        });

        // Update history
        const newHistory = [...matrixHistory.slice(0, currentHistoryIndex + 1), newMatrix];
        setMatrixHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);

        // Update the matrix through the callback
        if (onMatrixChange) {
            onMatrixChange(newMatrix);
        }
    };

    return (
        <Box>
            <HStack justify="space-between" mb={2}>
                <Box>
                    {title && <Heading size="sm">{title}</Heading>}
                    <Text>[[{numLegs}, {numLegs - n_stabilizers}]] ({matrix.every(isCSS) ? "CSS" : "non-CSS"})</Text>
                </Box>
                <HStack>
                    <Button
                        size="sm"
                        leftIcon={<FaUndo />}
                        onClick={handleUndo}
                        isDisabled={currentHistoryIndex <= 0}
                    >
                        Undo
                    </Button>
                    <Button
                        size="sm"
                        leftIcon={<FaRedo />}
                        onClick={handleRedo}
                        isDisabled={currentHistoryIndex >= matrixHistory.length - 1}
                    >
                        Redo
                    </Button>
                    {onRecalculate && (
                        <Button
                            size="sm"
                            leftIcon={<FaSync />}
                            onClick={onRecalculate}
                            colorScheme="blue"
                        >
                            Recalculate
                        </Button>
                    )}
                    {matrix.every(isCSS) && (
                        <Button
                            size="sm"
                            onClick={handleCSSSort}
                            colorScheme="orange"
                        >
                            CSS-sort
                        </Button>
                    )}
                </HStack>
            </HStack>
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
                                    color="red.600"
                                >
                                    X
                                </Td>
                                <Td
                                    p={2}
                                    textAlign="center"
                                    borderWidth={0}
                                    colSpan={matrix[0].length / 2}
                                    fontWeight="bold"
                                    color="green.600"
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
                                            color="red.600"
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
                                            color="green.600"
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
                                cursor="pointer"
                                bg={draggedRowIndex === rowIndex ? "blue.50" : highlightedRowIndex === rowIndex ? "gray.100" : "transparent"}
                                onClick={() => setHighlightedRowIndex(highlightedRowIndex === rowIndex ? null : rowIndex)}
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
            <Box mt={4}>
                <Grid templateColumns={matrix.every(isCSS) ? "repeat(2, 1fr)" : "1fr"} gap={4}>
                    <Box>
                        <Heading size="sm" mb={2}>Stabilizer View</Heading>
                        <VStack align="stretch" spacing={1}>
                            {matrix.map((row, index) => (
                                <HStack key={index} spacing={2}>
                                    <Text fontWeight="bold" width="30px">{index}.</Text>
                                    <HStack spacing={1}>
                                        {getPauliString(row).split('').map((pauli, i) => (
                                            <Text
                                                key={i}
                                                color={getPauliColor(pauli)}
                                                fontWeight="bold"
                                                fontFamily="monospace"
                                                fontSize="14px"
                                            >
                                                {pauli}
                                            </Text>
                                        ))}
                                    </HStack>
                                </HStack>
                            ))}
                        </VStack>
                    </Box>
                    {matrix.every(isCSS) && legOrdering && (
                        <Box>
                            <Heading size="sm" mb={2}>Graphical View</Heading>
                            <StabilizerGraphView
                                legs={legOrdering}
                                matrix={matrix}
                                width={600}
                                height={500}
                                highlightedStabilizer={highlightedRowIndex}
                            />
                        </Box>
                    )}
                </Grid>
            </Box>
        </Box>
    )
} 