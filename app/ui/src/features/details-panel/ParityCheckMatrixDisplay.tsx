import React, { useState, useEffect, useRef, memo, useCallback } from "react";
import {
  Box,
  Text,
  Heading,
  HStack,
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
import { FixedSizeList as List } from "react-window";
import { Resizable } from "re-resizable";

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

interface PauliRowProps {
  row: number[];
  rowIndex: number;
  numLegs: number;
  charWidth: number;
  getPauliString: (row: number[]) => string;
  getPauliColor: (pauli: string) => string;
  setTooltip: React.Dispatch<
    React.SetStateAction<{ x: number; y: number } | null>
  >;
  legOrdering?: TensorNetworkLeg[];
  onLegHover?: (leg: TensorNetworkLeg | null) => void;
  selectedRows: number[];
  draggedRowIndex: number | null;
  handleDragStart: (e: React.DragEvent, rowIndex: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, rowIndex: number) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleRowClick: (rowIndex: number) => void;
  setHoveredLegIndex: React.Dispatch<React.SetStateAction<number | null>>;
}

interface PauliCellProps {
  pauli: string;
  color: string;
  onHover: (index: number) => void;
  onUnhover: () => void;
  index: number;
  setTooltip: (
    pos: { x: number; y: number } | null,
    index: number | null
  ) => void;
  onRowClick?: () => void;
}

// Memoized PauliCell component
const PauliCell = memo(function PauliCell({
  pauli,
  color,
  onHover,
  onUnhover,
  index,
  setTooltip,
  onRowClick
}: PauliCellProps) {
  return (
    <span
      style={{
        color,
        background: "transparent",
        borderRadius: 3,
        cursor: "pointer"
      }}
      onMouseEnter={(e) => {
        onHover(index);
        setTooltip({ x: e.clientX, y: e.clientY }, index);
      }}
      onMouseLeave={() => {
        onUnhover();
        setTooltip(null, null);
      }}
      onClick={(e) => {
        e.stopPropagation(); // Prevent double-firing
        if (onRowClick) {
          onRowClick();
        }
      }}
    >
      {pauli}
    </span>
  );
});

// Memoized PauliRow component
const PauliRow = function PauliRow({
  row,
  rowIndex,
  numLegs,
  charWidth,
  getPauliString,
  getPauliColor,
  setTooltip,
  legOrdering,
  onLegHover,
  selectedRows,
  draggedRowIndex,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  handleRowClick,
  setHoveredLegIndex
}: PauliRowProps) {
  const pauliString = getPauliString(row);
  const [isDragOver, setIsDragOver] = useState(false);

  const isSelected = selectedRows.includes(rowIndex);
  const isDragged = draggedRowIndex === rowIndex;

  const getBackgroundColor = () => {
    if (isDragOver) return "#FFF5E6"; // Orange tint for drop zone
    if (isDragged) return "#E6F3FF"; // Light blue for dragged row
    if (isSelected) return "#F0F8FF"; // Very light blue for selected rows
    return "transparent";
  };

  const getBorderColor = () => {
    if (isDragOver) return "2px dashed #FF8C00"; // Orange dashed border for drop zone
    if (isSelected) return "1px solid #B0D4F1"; // Light blue border for selected
    return "1px solid transparent";
  };

  return (
    <div
      key={rowIndex}
      draggable
      onDragStart={(e) => handleDragStart(e, rowIndex)}
      onDragOver={handleDragOver}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        handleDrop(e, rowIndex);
        setIsDragOver(false);
      }}
      onDragEnd={handleDragEnd}
      onClick={() => handleRowClick(rowIndex)}
      style={{
        pointerEvents: "all",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: "grab",
        backgroundColor: getBackgroundColor(),
        padding: "1px",
        borderRadius: "6px",
        border: getBorderColor(),
        transition: "all 0.2s ease"
      }}
    >
      <Text fontSize={12} width="65px" flexShrink={0} color="gray.500">
        [{rowIndex}] w
        {row
          .slice(0, row.length / 2)
          .reduce(
            (w: number, x: number, i: number) =>
              w + (x || row[i + row.length / 2] ? 1 : 0),
            0
          )}
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
          {pauliString.split("").map((pauli, i) => (
            <PauliCell
              key={i}
              pauli={pauli}
              color={getPauliColor(pauli)}
              onHover={(idx) => {
                if (onLegHover && legOrdering && legOrdering[idx]) {
                  onLegHover(legOrdering[idx]);
                  setHoveredLegIndex(idx);
                }
              }}
              onUnhover={() => {
                if (onLegHover) onLegHover(null);
                setHoveredLegIndex(null);
              }}
              index={i}
              setTooltip={setTooltip}
              onRowClick={() => handleRowClick(rowIndex)}
            />
          ))}
        </Text>
      </Box>
    </div>
  );
};

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
  const [tooltipContent] = useState<string | null>(null);
  const hasInitialized = useRef(false);
  const charMeasureRef = useRef<HTMLSpanElement>(null);
  const [charWidth, setCharWidth] = useState<number>(8);
  const [listSize, setListSize] = useState({ width: 800, height: 600 });

  // Local selection state as fallback
  const [localSelectedRows, setLocalSelectedRows] = useState<number[]>([]);
  const [lastParentSelectedRows, setLastParentSelectedRows] = useState<
    number[]
  >([]);

  // Check if parent is updating selectedRows properly
  const parentUpdating =
    JSON.stringify(selectedRows) !== JSON.stringify(lastParentSelectedRows);

  // Use parent selectedRows if updating, otherwise use local state
  const effectiveSelectedRows = parentUpdating
    ? selectedRows
    : localSelectedRows;

  // Update tracking when parent selectedRows changes
  useEffect(() => {
    if (parentUpdating) {
      setLastParentSelectedRows([...selectedRows]);
      setLocalSelectedRows([...selectedRows]);
    }
  }, [selectedRows, parentUpdating]);

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

  // Memoize getPauliString and getPauliColor
  const getPauliString = useCallback((row: number[]) => {
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
  }, []);

  const getPauliColor = useCallback((pauli: string) => {
    const pauli_colors = {
      X: SVG_COLORS.X,
      Z: SVG_COLORS.Z,
      Y: SVG_COLORS.Y
    };
    return (
      pauli_colors[pauli.toUpperCase() as keyof typeof pauli_colors] || "black"
    );
  }, []);

  // Memoize drag/row handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, rowIndex: number) => {
      console.log("Drag start:", rowIndex);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", rowIndex.toString());
      // Delay state update to avoid blocking the drag start
      setTimeout(() => setDraggedRowIndex(rowIndex), 0);
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetRowIndex: number) => {
      e.preventDefault();
      e.stopPropagation();

      const draggedRowIndexStr = e.dataTransfer.getData("text/plain");
      const draggedIdx = parseInt(draggedRowIndexStr, 10);

      console.log("Drop:", draggedIdx, "onto", targetRowIndex);

      if (isNaN(draggedIdx) || draggedIdx === targetRowIndex) {
        setDraggedRowIndex(null);
        return;
      }

      // Create a new matrix with the rows added
      const newMatrix = matrix.map((row, index) => {
        if (index === targetRowIndex) {
          // Add the dragged row to the target row (modulo 2)
          return row.map(
            (cell, cellIndex) => (cell + matrix[draggedIdx][cellIndex]) % 2
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
    },
    [matrix, currentHistoryIndex, matrixHistory, onMatrixChange]
  );

  const handleDragEnd = useCallback(() => {
    console.log("Drag end");
    setDraggedRowIndex(null);
  }, []);

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

  // Memoize handleRowClick with minimal dependencies
  const handleRowClick = useCallback(
    (rowIndex: number) => {
      const newSelection = effectiveSelectedRows.includes(rowIndex)
        ? effectiveSelectedRows.filter((i) => i !== rowIndex)
        : [...effectiveSelectedRows, rowIndex];

      // Always update local state
      setLocalSelectedRows(newSelection);

      // Also try to update parent if callback provided
      if (onRowSelectionChange) {
        onRowSelectionChange(newSelection);
      }
    },
    [onRowSelectionChange, effectiveSelectedRows]
  );

  const handleLegReorder = (newLegOrdering: TensorNetworkLeg[]) => {
    if (onLegOrderingChange) {
      onLegOrderingChange(newLegOrdering);
    }
  };

  const isScalar = matrix.length === 1 && matrix[0].length === 1;

  const copyMatrixAsNumpy = () => {
    const numpyStr = `np.array([\n${matrix.map((row) => `    [${row.join(", ")}]`).join(",\n")}\n])`;
    navigator.clipboard.writeText(numpyStr);
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
  };

  if (isScalar) {
    return (
      <Box>
        <Text>Scalar</Text>
      </Box>
    );
  }

  // Create itemData object for react-window to detect changes
  const itemData = {
    matrix,
    numLegs,
    charWidth,
    getPauliString,
    getPauliColor,
    setTooltip: setMousePos,
    legOrdering,
    onLegHover,
    selectedRows: effectiveSelectedRows,
    draggedRowIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleRowClick,
    setHoveredLegIndex
  };

  // Add a key to force re-render when selection changes
  const listKey = `list-${effectiveSelectedRows.join("-")}-${draggedRowIndex || "none"}`;

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
            {/* TODO: Re-enable this when we have a way to re-order legs */}
            {/* {legOrdering && onLegOrderingChange && (
              <MenuItem onClick={() => setIsLegReorderDialogOpen(true)}>
                Reorder Legs
              </MenuItem>
            )} */}
            <MenuItem onClick={copyMatrixAsNumpy}>Copy as numpy</MenuItem>
            <MenuItem onClick={copyMatrixAsQdistrnd}>Copy as qdistrnd</MenuItem>
          </MenuList>
        </Menu>
      </HStack>

      <Box
        position="relative"
        width="100%"
        height="100%"
        mx={0}
        mt={6}
        style={{ flex: 1, minHeight: 0 }}
      >
        <Resizable
          size={listSize}
          minWidth={300}
          minHeight={200}
          maxWidth="100vw"
          maxHeight="100vh"
          onResizeStop={(e, direction, ref, d) => {
            setListSize({
              width: listSize.width + d.width,
              height: listSize.height + d.height
            });
          }}
        >
          {/* Pauli stabilizer rows - virtualized */}
          <List
            key={listKey}
            height={listSize.height}
            width={listSize.width}
            itemCount={matrix.length}
            itemSize={20}
            itemData={itemData}
          >
            {({
              index,
              style,
              data
            }: {
              index: number;
              style: React.CSSProperties;
              data: typeof itemData;
            }) => (
              <div
                style={{
                  ...style
                }}
                key={`${index}-${data.selectedRows.join(",")}`}
              >
                <PauliRow
                  row={data.matrix[index]}
                  rowIndex={index}
                  numLegs={data.numLegs}
                  charWidth={data.charWidth}
                  getPauliString={data.getPauliString}
                  getPauliColor={data.getPauliColor}
                  setTooltip={data.setTooltip}
                  legOrdering={data.legOrdering}
                  onLegHover={data.onLegHover}
                  selectedRows={data.selectedRows}
                  draggedRowIndex={data.draggedRowIndex}
                  handleDragStart={data.handleDragStart}
                  handleDragOver={data.handleDragOver}
                  handleDrop={data.handleDrop}
                  handleDragEnd={data.handleDragEnd}
                  handleRowClick={data.handleRowClick}
                  setHoveredLegIndex={data.setHoveredLegIndex}
                />
              </div>
            )}
          </List>
          {/* Floating Tooltip for hovered column */}
          {hoveredLegIndex !== null &&
            mousePos &&
            legOrdering &&
            legOrdering[hoveredLegIndex] && (
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
                Tensor: <b>{legOrdering[hoveredLegIndex].instanceId}</b> &nbsp;
                Leg: <b>{legOrdering[hoveredLegIndex].legIndex}</b>
              </Box>
            )}
          {mousePos && tooltipContent && (
            <Box
              position="fixed"
              left={mousePos.x + 10}
              top={mousePos.y + 10}
              zIndex={1000}
              bg="white"
              border="1px solid #ccc"
              p={2}
              borderRadius="md"
              pointerEvents="none"
              fontSize="sm"
              boxShadow="md"
            >
              {tooltipContent}
            </Box>
          )}
        </Resizable>
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

export default ParityCheckMatrixDisplay;
