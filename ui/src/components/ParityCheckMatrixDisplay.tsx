import { Box, Text, Heading, Table, Thead, Tbody, Tr, Td, Button, HStack, VStack, Grid, useToast } from '@chakra-ui/react'
import { LegoPiece, TensorNetworkLeg } from '../types.ts'
import { useState, useEffect, useRef } from 'react'
import { FaUndo, FaRedo, FaSync } from 'react-icons/fa'
import { StabilizerGraphView } from './StabilizerGraphView'
import { X_COLOR, Z_COLOR, X_COLOR_LIGHT, Z_COLOR_LIGHT, X_COLOR_DARK, Z_COLOR_DARK, Y_COLOR } from '../utils/PauliColors'

interface ParityCheckMatrixDisplayProps {
    matrix: number[][];
    title?: string;
    lego?: LegoPiece;
    legOrdering?: TensorNetworkLeg[];
    onMatrixChange?: (newMatrix: number[][]) => void;
    onLegOrderingChange?: (newLegOrdering: TensorNetworkLeg[]) => void;
    onRecalculate?: () => void;
    selectedRows?: number[];
    onRowSelectionChange?: (selectedRows: number[]) => void;
}

export const ParityCheckMatrixDisplay: React.FC<ParityCheckMatrixDisplayProps> = ({
    matrix,
    title,
    lego,
    legOrdering,
    onMatrixChange,
    onLegOrderingChange,
    onRecalculate,
    selectedRows = [],
    onRowSelectionChange
}) => {
    const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
    const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
    const [highlightedRowIndex,] = useState<number | null>(null);
    const [matrixHistory, setMatrixHistory] = useState<number[][][]>([]);
    const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
    const hasInitialized = useRef(false);
    const toast = useToast();

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

    const handleColumnDragStart = (e: React.DragEvent, columnIndex: number) => {
        setDraggedColumnIndex(columnIndex);
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

    const handleColumnDrop = (e: React.DragEvent, targetColumnIndex: number) => {
        e.preventDefault();
        if (draggedColumnIndex === null || draggedColumnIndex === targetColumnIndex) return;

        // Check if we're trying to move between X and Z sections
        const isDraggedX = draggedColumnIndex < matrix[0].length / 2;
        const isTargetX = targetColumnIndex < matrix[0].length / 2;
        if (isDraggedX !== isTargetX) return;

        // Create a new matrix with the columns reordered
        const newMatrix = matrix.map(row => {
            const newRow = [...row];
            const halfLength = matrix[0].length / 2;

            // Get the actual indices for both sections
            const xDraggedIndex = isDraggedX ? draggedColumnIndex : draggedColumnIndex - halfLength;
            const xTargetIndex = isDraggedX ? targetColumnIndex : targetColumnIndex - halfLength;
            const zDraggedIndex = isDraggedX ? draggedColumnIndex + halfLength : draggedColumnIndex;
            const zTargetIndex = isDraggedX ? targetColumnIndex + halfLength : targetColumnIndex;

            // Perform the swap in the X section
            const tempX = newRow[xDraggedIndex];
            if (xDraggedIndex < xTargetIndex) {
                // Moving right
                for (let i = xDraggedIndex; i < xTargetIndex; i++) {
                    newRow[i] = newRow[i + 1];
                }
            } else {
                // Moving left
                for (let i = xDraggedIndex; i > xTargetIndex; i--) {
                    newRow[i] = newRow[i - 1];
                }
            }
            newRow[xTargetIndex] = tempX;

            // Perform the swap in the Z section
            const tempZ = newRow[zDraggedIndex];
            if (zDraggedIndex < zTargetIndex) {
                // Moving right
                for (let i = zDraggedIndex; i < zTargetIndex; i++) {
                    newRow[i] = newRow[i + 1];
                }
            } else {
                // Moving left
                for (let i = zDraggedIndex; i > zTargetIndex; i--) {
                    newRow[i] = newRow[i - 1];
                }
            }
            newRow[zTargetIndex] = tempZ;

            return newRow;
        });

        // Update leg ordering if it exists
        let newLegOrdering: TensorNetworkLeg[] | undefined;
        if (legOrdering) {
            newLegOrdering = [...legOrdering];
            const legIndex = isDraggedX ? draggedColumnIndex : draggedColumnIndex - matrix[0].length / 2;
            const targetLegIndex = isDraggedX ? targetColumnIndex : targetColumnIndex - matrix[0].length / 2;
            const temp = newLegOrdering[legIndex];
            if (legIndex < targetLegIndex) {
                // Moving right
                for (let i = legIndex; i < targetLegIndex; i++) {
                    newLegOrdering[i] = newLegOrdering[i + 1];
                }
            } else {
                // Moving left
                for (let i = legIndex; i > targetLegIndex; i--) {
                    newLegOrdering[i] = newLegOrdering[i - 1];
                }
            }
            newLegOrdering[targetLegIndex] = temp;
        }

        // Update history
        const newHistory = [...matrixHistory.slice(0, currentHistoryIndex + 1), newMatrix];
        setMatrixHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);

        // Update the matrix through the callback first
        if (onMatrixChange) {
            onMatrixChange(newMatrix);
        }

        // Then update leg ordering through the callback
        if (newLegOrdering && onLegOrderingChange) {
            onLegOrderingChange(newLegOrdering);
        }

        setDraggedColumnIndex(null);
    };

    const handleDragEnd = () => {
        setDraggedRowIndex(null);
        setDraggedColumnIndex(null);
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

    const getPauliWeight = (row: number[]): number => {
        const n = row.length / 2;
        let weight = 0;
        for (let i = 0; i < n; i++) {
            weight += row[i] == 1 || row[i + n] == 1 ? 1 : 0;
        }
        return weight;
    };

    const getPauliColor = (pauli: string): string => {
        switch (pauli) {
            case 'X': return X_COLOR;
            case 'Z': return Z_COLOR;
            case 'Y': return Y_COLOR;
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

    const handleRowClick = (e: React.MouseEvent, rowIndex: number) => {
        if (e.ctrlKey || e.metaKey) {
            // Toggle selection
            const newSelection = selectedRows.includes(rowIndex)
                ? selectedRows.filter(i => i !== rowIndex)
                : [...selectedRows, rowIndex];
            onRowSelectionChange?.(newSelection);
        } else {
            // Single selection
            onRowSelectionChange?.([rowIndex]);
        }
    };

    const isScalar = matrix.length === 1 && matrix[0].length === 1;

    const copyMatrixAsNumpy = () => {
        const numpyStr = `np.array([\n${matrix.map(row => `    [${row.join(', ')}]`).join(',\n')}\n])`;
        navigator.clipboard.writeText(numpyStr);
        toast({
            title: "Copied to clipboard",
            description: "Matrix copied in numpy format",
            status: "success",
            duration: 2000,
            isClosable: true,
        });
    };

    const copyMatrixAsQdistrnd = () => {
        const n = matrix[0].length / 2; // Number of qubits


        const arrayStr = 'H:=One(F)*[' + matrix.map(row => {
            const pairs = [];
            for (let i = 0; i < n; i++) {
                pairs.push(`${row[i]},${row[i + n]}`);
            }
            return `[${pairs.join(', ')}]`;
        }).join(',\n') + '];;\n';

        const qdistrndStr = 'F:=GF(2);;\n' + arrayStr + 'DistRandStab(H,100,0,2:field:=F);'
        navigator.clipboard.writeText(qdistrndStr);
        toast({
            title: "Copied to clipboard",
            description: "Matrix copied in qdistrnd format",
            status: "success",
            duration: 2000,
            isClosable: true,
        });
    };

    if (isScalar) {
        return (
            <Box>
                <Text>Scalar</Text>
            </Box>
        )
    }

    // Check if matrix is too large for table display
    if (numLegs > 50) {
        return (
            <Box>
                <HStack justify="space-between" mb={2}>
                    <Box>
                        {title && <Heading size="sm">{title}</Heading>}
                        <Text>[[{numLegs}, {numLegs - n_stabilizers}]] ({matrix.every(isCSS) ? "CSS" : "non-CSS"})</Text>
                    </Box>
                    <HStack>
                        {matrix.every(isCSS) && numLegs <= 150 && (
                            <Button
                                size="sm"
                                onClick={handleCSSSort}
                                colorScheme="orange"
                            >
                                CSS-sort
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={copyMatrixAsNumpy}
                            colorScheme="purple"
                        >
                            Copy as numpy
                        </Button>
                        <Button
                            size="sm"
                            onClick={copyMatrixAsQdistrnd}
                            colorScheme="purple"
                        >
                            Copy as qdistrnd
                        </Button>
                    </HStack>
                </HStack>
                <Text color="red.500" fontWeight="bold" mb={4}>
                    Matrix is too big ({numLegs} legs &gt; 50) for interactive matrix display
                </Text>
                {numLegs <= 150 && (
                    <Box>
                        <Heading size="sm" mb={2}>Stabilizer View</Heading>
                        <VStack align="stretch" spacing={1}>
                            {matrix.map((row, index) => (
                                <HStack
                                    key={index}
                                    spacing={2}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                    cursor="pointer"
                                    bg={draggedRowIndex === index ? "blue.50" : "transparent"}
                                    p={1}
                                    borderRadius="md"
                                >
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
                                        <Text fontSize="14px" >  | {getPauliWeight(row)} </Text>
                                    </HStack>
                                </HStack>
                            ))}
                        </VStack>
                    </Box>
                )}
            </Box>
        );
    }

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
                    <Button
                        size="sm"
                        onClick={copyMatrixAsNumpy}
                        colorScheme="purple"
                    >
                        Copy as numpy
                    </Button>
                    <Button
                        size="sm"
                        onClick={copyMatrixAsQdistrnd}
                        colorScheme="purple"
                    >
                        Copy as qdistrnd
                    </Button>
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
                                    color={X_COLOR_DARK}
                                >
                                    X
                                </Td>
                                <Td
                                    p={2}
                                    textAlign="center"
                                    borderWidth={0}
                                    colSpan={matrix[0].length / 2}
                                    fontWeight="bold"
                                    color={Z_COLOR_DARK}
                                >
                                    Z
                                </Td>
                            </>
                        </Tr>
                        {legOrdering && (
                            <Tr>
                                <>
                                    {/* X lego indices */}
                                    {legOrdering?.map((leg, index) => (
                                        <Td
                                            key={`x-legoidx-${leg.instanceId}-${leg.legIndex}`}
                                            p={2}
                                            textAlign="center"
                                            borderWidth={0}
                                            colSpan={1}
                                            fontSize="sm"
                                            color={X_COLOR_DARK}
                                            draggable
                                            onDragStart={(e) => handleColumnDragStart(e, index)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleColumnDrop(e, index)}
                                            onDragEnd={handleDragEnd}
                                            cursor="move"
                                            bg={draggedColumnIndex === index ? "blue.50" : "transparent"}
                                        >
                                            {leg.instanceId}-{leg.legIndex}
                                        </Td>
                                    ))}
                                    {/* Z lego indices */}
                                    {legOrdering?.map((leg, index) => (
                                        <Td
                                            key={`z-legoidx-${leg.instanceId}-${leg.legIndex}`}
                                            p={2}
                                            textAlign="center"
                                            borderWidth={0}
                                            colSpan={1}
                                            fontSize="sm"
                                            color={Z_COLOR_DARK}
                                            draggable
                                            onDragStart={(e) => handleColumnDragStart(e, index + matrix[0].length / 2)}
                                            onDragOver={handleDragOver}
                                            onDrop={(e) => handleColumnDrop(e, index + matrix[0].length / 2)}
                                            onDragEnd={handleDragEnd}
                                            cursor="move"
                                            bg={draggedColumnIndex === index + matrix[0].length / 2 ? "blue.50" : "transparent"}
                                        >
                                            {leg.instanceId}-{leg.legIndex}
                                        </Td>
                                    ))}
                                </>
                            </Tr>)
                            ||
                            <Tr>
                                {getLegIndices().map((leg, index) => (
                                    <Td
                                        key={`x-idx-${leg}`}
                                        p={2}
                                        textAlign="center"
                                        borderWidth={0}
                                        colSpan={1}
                                        fontSize="sm"
                                        {...getColumnStyle(leg)}
                                        draggable
                                        onDragStart={(e) => handleColumnDragStart(e, index)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleColumnDrop(e, index)}
                                        onDragEnd={handleDragEnd}
                                        cursor="move"
                                        bg={draggedColumnIndex === index ? "blue.50" : "transparent"}
                                    >
                                        {leg}
                                    </Td>
                                ))}
                                {getLegIndices().map((leg, index) => (
                                    <Td
                                        key={`z-idx-${leg}`}
                                        p={2}
                                        textAlign="center"
                                        borderWidth={0}
                                        colSpan={1}
                                        fontSize="sm"
                                        {...getColumnStyle(leg)}
                                        draggable
                                        onDragStart={(e) => handleColumnDragStart(e, index + matrix[0].length / 2)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleColumnDrop(e, index + matrix[0].length / 2)}
                                        onDragEnd={handleDragEnd}
                                        cursor="move"
                                        bg={draggedColumnIndex === index + matrix[0].length / 2 ? "blue.50" : "transparent"}
                                    >
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
                                bg={
                                    draggedRowIndex === rowIndex ? "blue.50" :
                                        highlightedRowIndex === rowIndex ? "gray.100" :
                                            "transparent"
                                }
                                onClick={(e) => handleRowClick(e, rowIndex)}
                            >
                                {row.map((cell, cellIndex) => {
                                    const isMiddle = cellIndex === row.length / 2 - 1;
                                    const isSelected = selectedRows.includes(rowIndex);
                                    return (
                                        <Td
                                            key={cellIndex}
                                            p={2}
                                            textAlign="center"
                                            bg={cell === 1 ? (cellIndex < row.length / 2 ? X_COLOR_LIGHT : Z_COLOR_LIGHT) : "transparent"}
                                            borderWidth={isSelected ? 2 : 1}
                                            borderColor={isSelected ? "blue.500" : "gray.200"}
                                            borderRightWidth={isMiddle ? (isSelected ? 3 : 2) : (isSelected ? 2 : 1)}
                                            borderRightColor={isMiddle ? (isSelected ? "blue.500" : "gray.400") : (isSelected ? "blue.500" : "gray.200")}
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
                                <HStack
                                    key={index}
                                    spacing={2}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragEnd={handleDragEnd}
                                    cursor="pointer"
                                    bg={draggedRowIndex === index ? "blue.50" : "transparent"}
                                    p={1}
                                    borderRadius="md"
                                >
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
                                        <Text fontSize="14px" >  | {getPauliWeight(row)} </Text>
                                    </HStack>
                                </HStack>
                            ))}
                        </VStack>
                    </Box>
                    {matrix.every(isCSS) && legOrdering && (
                        <Box>
                            <HStack justify="space-between" mb={2}>
                                <Heading size="sm">Tanner Graph</Heading>
                            </HStack>
                            <Text size="sm">Circles are the legs (qubits), squares are the stabilizers.</Text>
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