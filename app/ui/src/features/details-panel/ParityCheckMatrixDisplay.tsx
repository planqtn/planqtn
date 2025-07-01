import React, { useState, useEffect, useRef, memo } from "react";
import {
  Box,
  Text,
  Heading,
  HStack,
  VStack,
  useToast,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton
} from "@chakra-ui/react";
import { FaEllipsisV } from "react-icons/fa";
import { TensorNetworkLeg } from "../../lib/TensorNetwork.ts";
import { LegReorderDialog } from "./LegReorderDialog.tsx";
import { SVG_COLORS } from "../../lib/PauliColors.ts";

interface ParityCheckMatrixDisplayProps {
  matrix: number[][];
  title?: string;
  legOrdering?: TensorNetworkLeg[];
  onMatrixChange?: (newMatrix: number[][]) => void;
  onLegOrderingChange?: (newLegOrdering: TensorNetworkLeg[]) => void;
  onRecalculate?: () => void;
  selectedRows?: number[];
  onRowSelectionChange?: (selectedRows: number[]) => void;
  onLegHover?: (leg: TensorNetworkLeg | null) => void;
}

export const ParityCheckMatrixDisplay: React.FC<
  ParityCheckMatrixDisplayProps
> = ({
  matrix,
  title,
  legOrdering,
  onMatrixChange,
  onLegOrderingChange,
  onRecalculate,
  selectedRows = [],
  onRowSelectionChange,
  onLegHover
}) => {
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [matrixHistory, setMatrixHistory] = useState<number[][][]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [isLegReorderDialogOpen, setIsLegReorderDialogOpen] = useState(false);
  const [hoveredLegIndex, setHoveredLegIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null
  );
  const hasInitialized = useRef(false);
  const toast = useToast();
  const charMeasureRef = useRef<HTMLSpanElement>(null);
  const [charWidth, setCharWidth] = useState<number>(8);

  // Initialize history only once when component mounts
  useEffect(() => {
    if (!hasInitialized.current) {
      setMatrixHistory([matrix]);
      setCurrentHistoryIndex(0);
      hasInitialized.current = true;
    }
  }, []); // Empty dependency array means this only runs on mount

  useEffect(() => {
    if (charMeasureRef.current) {
      setCharWidth(charMeasureRef.current.getBoundingClientRect().width);
    }
  }, [matrix]);

  if (!matrix || matrix.length === 0) return null;

  const numLegs = matrix[0].length / 2;
  const n_stabilizers = matrix.length;

  const handleDragStart = (e: React.DragEvent, rowIndex: number) => {
    setDraggedRowIndex(rowIndex);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetRowIndex: number) => {
    e.preventDefault();
    if (draggedRowIndex === null || draggedRowIndex === targetRowIndex) return;

    // Create a new matrix with the rows added
    const newMatrix = matrix.map((row, index) => {
      if (index === targetRowIndex) {
        // Add the dragged row to the target row (modulo 2)
        return row.map(
          (cell, cellIndex) => (cell + matrix[draggedRowIndex][cellIndex]) % 2
        );
      }
      return row;
    });

    // Update history
    const newHistory = [
      ...matrixHistory.slice(0, currentHistoryIndex + 1),
      newMatrix
    ];
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
    let result = "";
    for (let i = 0; i < n; i++) {
      const x = row[i];
      const z = row[i + n];
      if (x === 0 && z === 0) result += "_";
      else if (x === 1 && z === 0) result += "X";
      else if (x === 0 && z === 1) result += "Z";
      else if (x === 1 && z === 1) result += "Y";
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

  const pauli_colors = {
    X: SVG_COLORS.X,
    Z: SVG_COLORS.Z,
    Y: SVG_COLORS.Y
  };

  const getPauliColor = (pauli: string): string => {
    return (
      pauli_colors[pauli.toUpperCase() as keyof typeof pauli_colors] || "black"
    );
  };

  const isCSS = (row: number[]): boolean => {
    const n = row.length / 2;
    // Check if the row has only X or only Z components
    const hasX = row.slice(0, n).some((x) => x === 1);
    const hasZ = row.slice(n).some((z) => z === 1);
    return (hasX && !hasZ) || (!hasX && hasZ);
  };

  const handleCSSSort = () => {
    // Create a new matrix with rows sorted by CSS type
    const newMatrix = [...matrix].sort((a, b) => {
      const n = a.length / 2;
      const aHasX = a.slice(0, n).some((x) => x === 1);
      const aHasZ = a.slice(n).some((z) => z === 1);
      const bHasX = b.slice(0, n).some((x) => x === 1);
      const bHasZ = b.slice(n).some((z) => z === 1);

      // X-only rows come first
      if (aHasX && !aHasZ && (!bHasX || bHasZ)) return -1;
      if (bHasX && !bHasZ && (!aHasX || aHasZ)) return 1;

      // Z-only rows come second
      if (!aHasX && aHasZ && (bHasX || !bHasZ)) return -1;
      if (!bHasX && bHasZ && (aHasX || !aHasZ)) return 1;

      return 0;
    });

    // Update history
    const newHistory = [
      ...matrixHistory.slice(0, currentHistoryIndex + 1),
      newMatrix
    ];
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
        ? selectedRows.filter((i) => i !== rowIndex)
        : [...selectedRows, rowIndex];
      onRowSelectionChange?.(newSelection);
    } else {
      // Single selection
      onRowSelectionChange?.([rowIndex]);
    }
  };

  const handleLegReorder = (newLegOrdering: TensorNetworkLeg[]) => {
    if (onLegOrderingChange) {
      onLegOrderingChange(newLegOrdering);
    }
  };

  const isScalar = matrix.length === 1 && matrix[0].length === 1;

  const copyMatrixAsNumpy = () => {
    const numpyStr = `np.array([\n${matrix.map((row) => `    [${row.join(", ")}]`).join(",\n")}\n])`;
    navigator.clipboard.writeText(numpyStr);
    toast({
      title: "Copied to clipboard",
      description: "Matrix copied in numpy format",
      status: "success",
      duration: 2000,
      isClosable: true
    });
  };

  const copyMatrixAsQdistrnd = () => {
    const n = matrix[0].length / 2; // Number of qubits

    const arrayStr =
      "H:=One(F)*[" +
      matrix
        .map((row) => {
          const pairs = [];
          for (let i = 0; i < n; i++) {
            pairs.push(`${row[i]},${row[i + n]}`);
          }
          return `[${pairs.join(", ")}]`;
        })
        .join(",\n") +
      "];;\n";

    const qdistrndStr =
      "F:=GF(2);;\n" + arrayStr + "DistRandStab(H,100,0,2:field:=F);";
    navigator.clipboard.writeText(qdistrndStr);
    toast({
      title: "Copied to clipboard",
      description: "Matrix copied in qdistrnd format",
      status: "success",
      duration: 2000,
      isClosable: true
    });
  };

  if (isScalar) {
    return (
      <Box>
        <Text>Scalar</Text>
      </Box>
    );
  }

  return (
    <Box>
      <HStack justify="space-between" mb={2}>
        <Box>
          {title && <Heading size="sm">{title}</Heading>}
          <Text>
            [[{numLegs}, {numLegs - n_stabilizers}]] (
            {matrix.every(isCSS) ? "CSS" : "non-CSS"})
          </Text>
        </Box>
        <Menu>
          <MenuButton
            as={IconButton}
            icon={<FaEllipsisV />}
            variant="outline"
            size="sm"
            aria-label="Matrix actions"
          />
          <MenuList>
            <MenuItem
              onClick={handleUndo}
              isDisabled={currentHistoryIndex <= 0}
            >
              Undo
            </MenuItem>
            <MenuItem
              onClick={handleRedo}
              isDisabled={currentHistoryIndex >= matrixHistory.length - 1}
            >
              Redo
            </MenuItem>
            {onRecalculate && (
              <MenuItem onClick={onRecalculate}>Recalculate</MenuItem>
            )}
            {matrix.every(isCSS) && (
              <MenuItem onClick={handleCSSSort}>CSS-sort</MenuItem>
            )}
            {legOrdering && onLegOrderingChange && (
              <MenuItem onClick={() => setIsLegReorderDialogOpen(true)}>
                Reorder Legs
              </MenuItem>
            )}
            <MenuItem onClick={copyMatrixAsNumpy}>Copy as numpy</MenuItem>
            <MenuItem onClick={copyMatrixAsQdistrnd}>Copy as qdistrnd</MenuItem>
          </MenuList>
        </Menu>
      </HStack>

      <Box position="relative" width="fit-content" mx={0} mt={6}>
        {/* Pauli stabilizer rows */}
        <VStack align="stretch" spacing={1}>
          {/* Hidden span for measuring monospace char width */}
          <span
            ref={charMeasureRef}
            style={{
              fontFamily: "monospace",
              fontSize: "16px",
              visibility: "hidden",
              position: "absolute"
            }}
          >
            X
          </span>
          {matrix.map((row, rowIndex) => (
            <HStack
              key={rowIndex}
              spacing={2}
              draggable
              onDragStart={(e) => handleDragStart(e, rowIndex)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, rowIndex)}
              onDragEnd={handleDragEnd}
              cursor="pointer"
              bg={
                draggedRowIndex === rowIndex
                  ? "blue.50"
                  : selectedRows.includes(rowIndex)
                    ? "blue.100"
                    : "transparent"
              }
              p={1}
              borderRadius="md"
              onClick={(e) => handleRowClick(e, rowIndex)}
              _hover={{
                bg: selectedRows.includes(rowIndex) ? "blue.100" : "gray.50"
              }}
              border={
                selectedRows.includes(rowIndex) ? "1px solid" : "1px solid"
              }
              borderColor={
                selectedRows.includes(rowIndex) ? "blue.500" : "transparent"
              }
            >
              <Text fontWeight="bold" width="30px">
                {rowIndex}.
              </Text>
              <Box position="relative" width={numLegs * charWidth}>
                <Text
                  as="span"
                  fontFamily="monospace"
                  fontSize="16px"
                  whiteSpace="pre"
                  letterSpacing={0}
                  lineHeight={1}
                  p={0}
                  m={0}
                >
                  {getPauliString(row)
                    .split("")
                    .map((pauli, i) => (
                      <span
                        key={i}
                        style={{
                          color: getPauliColor(pauli),
                          background:
                            hoveredLegIndex === i ? "#E6FFFA" : undefined,
                          borderRadius: hoveredLegIndex === i ? 3 : undefined,
                          cursor: "pointer"
                        }}
                        onMouseEnter={(e) => {
                          setHoveredLegIndex(i);
                          setMousePos({ x: e.clientX, y: e.clientY });
                          if (onLegHover && legOrdering)
                            onLegHover(legOrdering[i]);
                        }}
                        onMouseMove={(e) => {
                          setMousePos({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => {
                          setHoveredLegIndex(null);
                          setMousePos(null);
                          if (onLegHover) onLegHover(null);
                        }}
                      >
                        {pauli}
                      </span>
                    ))}
                </Text>
              </Box>
              <Text
                fontSize="14px"
                color="gray.500"
                whiteSpace="nowrap"
                flexShrink={0}
              >
                | {getPauliWeight(row)}
              </Text>
            </HStack>
          ))}
        </VStack>
        {/* Floating Tooltip for hovered column */}
        {hoveredLegIndex !== null && mousePos && legOrdering && (
          <Box
            position="fixed"
            left={mousePos.x + 12}
            top={mousePos.y - 32}
            bg="gray.700"
            color="white"
            px={3}
            py={1}
            borderRadius="md"
            fontSize="sm"
            opacity={0.92}
            pointerEvents="none"
            zIndex={9999}
            boxShadow="md"
            style={{
              transform: "translate(-50%, -100%)"
            }}
          >
            Tensor: <b>{legOrdering[hoveredLegIndex].instanceId}</b> &nbsp; Leg:{" "}
            <b>{legOrdering[hoveredLegIndex].legIndex}</b>
          </Box>
        )}
      </Box>

      {legOrdering && onLegOrderingChange && (
        <LegReorderDialog
          isOpen={isLegReorderDialogOpen}
          onClose={() => setIsLegReorderDialogOpen(false)}
          onSubmit={handleLegReorder}
          legOrdering={legOrdering}
        />
      )}
    </Box>
  );
};

// Custom comparison function that ignores position changes
const arePropsEqual = (
  prevProps: ParityCheckMatrixDisplayProps,
  nextProps: ParityCheckMatrixDisplayProps
) => {
  // Compare matrix deeply
  if (prevProps.matrix.length !== nextProps.matrix.length) return false;
  for (let i = 0; i < prevProps.matrix.length; i++) {
    if (prevProps.matrix[i].length !== nextProps.matrix[i].length) return false;
    for (let j = 0; j < prevProps.matrix[i].length; j++) {
      if (prevProps.matrix[i][j] !== nextProps.matrix[i][j]) return false;
    }
  }

  // Compare other props (excluding functions which should be stable)
  if (prevProps.title !== nextProps.title) return false;

  // Compare legOrdering deeply
  if (prevProps.legOrdering?.length !== nextProps.legOrdering?.length)
    return false;
  if (prevProps.legOrdering && nextProps.legOrdering) {
    for (let i = 0; i < prevProps.legOrdering.length; i++) {
      if (
        prevProps.legOrdering[i].instanceId !==
          nextProps.legOrdering[i].instanceId ||
        prevProps.legOrdering[i].legIndex !== nextProps.legOrdering[i].legIndex
      )
        return false;
    }
  }

  // Compare selectedRows
  if (prevProps.selectedRows?.length !== nextProps.selectedRows?.length)
    return false;
  if (prevProps.selectedRows && nextProps.selectedRows) {
    for (let i = 0; i < prevProps.selectedRows.length; i++) {
      if (prevProps.selectedRows[i] !== nextProps.selectedRows[i]) return false;
    }
  }

  return true;
};

export default memo(ParityCheckMatrixDisplay, arePropsEqual);
