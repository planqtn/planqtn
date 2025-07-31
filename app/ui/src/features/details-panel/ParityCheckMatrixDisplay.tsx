import React, { useState, useEffect, useRef, memo, useCallback } from "react";
import { Box, Text, HStack, IconButton } from "@chakra-ui/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

import { FaCopy, FaEllipsisV } from "react-icons/fa";
import { TensorNetwork, TensorNetworkLeg } from "../../lib/TensorNetwork.ts";
import { FixedSizeList as List } from "react-window";
import { useCanvasStore } from "@/stores/canvasStateStore.ts";
import { FiExternalLink } from "react-icons/fi";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { TooltipPortal } from "@radix-ui/react-tooltip";
import { usePanelConfigStore } from "@/stores/panelConfigStore.ts";
import { SVG_COLORS } from "../../lib/PauliColors.ts";
import { FaDropletSlash } from "react-icons/fa6";
import { DroppedLego } from "@/stores/droppedLegoStore.ts";

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
  signature?: string;
  isDisabled?: boolean;
  popOut?: boolean;
  lego?: DroppedLego;
}

interface PauliRowProps {
  row: number[];
  rowIndex: number;
  numLegs: number;
  charWidth: number;
  getPauliString: (row: number[]) => string;
  getPauliColor: (pauli: string) => string;
  selectedRows: number[];
  draggedRowIndex: number | null;
  handleDragStart: (e: React.DragEvent, rowIndex: number) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent, rowIndex: number) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleRowClick: (rowIndex: number) => void;
  legOrdering?: TensorNetworkLeg[];
  isDisabled?: boolean;
}

interface PauliCellProps {
  pauli: string;
  color: string;
  onRowClick?: () => void;
  onCellClick?: () => void;
  index: number;
  hoverText?: string;
}

// Memoized PauliCell component
const PauliCell = memo(function PauliCell({
  pauli,
  color,
  onRowClick,
  onCellClick,
  isDisabled,
  hoverText
}: PauliCellProps & { isDisabled?: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <Tooltip>
      <TooltipTrigger>
        <span
          style={{
            color: isHovered ? "orange" : color,
            border: isHovered ? "1px solid orange" : "0px",
            backgroundColor: isHovered ? "blue.400" : "transparent",
            padding: "0px",
            margin: "0px",
            cursor: isDisabled ? "not-allowed" : "pointer"
          }}
          onMouseEnter={(e) => {
            setIsHovered(true);
          }}
          onMouseLeave={() => {
            setIsHovered(false);
          }}
          onClick={(e) => {
            if (isDisabled) {
              e.preventDefault();
              return;
            }
            if (!e.ctrlKey && e.altKey) {
              if (onCellClick) {
                onCellClick();
              }
            } else if (e.ctrlKey && !e.altKey) {
              if (onRowClick && !isDisabled) {
                onRowClick();
              }
            }
          }}
        >
          {pauli}
        </span>
      </TooltipTrigger>
      <TooltipContent className="bg-black text-white high-z">
        <Text>{hoverText}</Text>
      </TooltipContent>
    </Tooltip>
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
  selectedRows,
  draggedRowIndex,
  handleDragStart,
  handleDragOver,
  handleDrop,
  handleDragEnd,
  handleRowClick,
  legOrdering,
  isDisabled
}: PauliRowProps) {
  const pauliString = getPauliString(row);
  const [isDragOver, setIsDragOver] = useState(false);
  const setTensorNetwork = useCanvasStore((state) => state.setTensorNetwork);
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const focusOnTensorNetwork = useCanvasStore(
    (state) => state.focusOnTensorNetwork
  );

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
      draggable={!isDisabled}
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
      onClick={(e) => {
        if (!e.ctrlKey) {
          e.preventDefault();
        } else {
          handleRowClick(rowIndex);
        }
      }}
      style={{
        pointerEvents: "all",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: isDisabled ? "default" : "grab",
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
              onRowClick={() => handleRowClick(rowIndex)}
              onCellClick={() => {
                if (legOrdering && legOrdering[i]) {
                  const lego = droppedLegos.find(
                    (lego) => lego.instance_id === legOrdering[i].instance_id
                  );
                  if (lego) {
                    setTensorNetwork(
                      new TensorNetwork({ legos: [lego], connections: [] })
                    );
                    focusOnTensorNetwork();
                  }
                }
              }}
              index={i}
              isDisabled={isDisabled}
              hoverText={`Generator ${rowIndex} • Qubit ${i} • ${legOrdering && legOrdering[i] ? "lego: " + legOrdering[i].instance_id + " leg: " + legOrdering[i].leg_index : ""}`}
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
  onRecalculate,
  selectedRows = [],
  onRowSelectionChange,
  onLegHover,
  signature,
  isDisabled = false,
  popOut = false,
  lego
}) => {
  const [draggedRowIndex] = useState<number | null>(null);
  const setTensorNetwork = useCanvasStore((state) => state.setTensorNetwork);
  const focusOnTensorNetwork = useCanvasStore(
    (state) => state.focusOnTensorNetwork
  );
  const getCachedTensorNetwork = useCanvasStore(
    (state) => state.getCachedTensorNetwork
  );
  const [matrixHistory, setMatrixHistory] = useState<number[][][]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const hasInitialized = useRef(false);
  const charMeasureRef = useRef<HTMLSpanElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listRef = useRef<any>(null);
  const [charWidth, setCharWidth] = useState<number>(8);
  const [listSize, setListSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setListSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
    };
  }, []);

  // // Prevent wheel events during drag operations
  // useEffect(() => {
  //   const handleWheel = (e: WheelEvent) => {
  //     if (draggedRowIndex !== null) {
  //       e.preventDefault();
  //       e.stopPropagation();
  //     }
  //   };

  //   if (draggedRowIndex !== null) {
  //     document.addEventListener("wheel", handleWheel, { passive: false });
  //     return () => {
  //       document.removeEventListener("wheel", handleWheel);
  //     };
  //   }
  // }, [draggedRowIndex]);

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
      if (isDisabled) {
        e.preventDefault();
        return;
      }
      console.log("Drag start:", rowIndex);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", rowIndex.toString());

      // Prevent scrolling during drag
      document.body.style.overflow = "hidden";

      // Don't update drag state to prevent re-renders during drag
      // setDraggedRowIndex(rowIndex);
    },
    [isDisabled]
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

      // Re-enable scrolling
      document.body.style.overflow = "";

      const draggedRowIndexStr = e.dataTransfer.getData("text/plain");
      const draggedIdx = parseInt(draggedRowIndexStr, 10);

      console.log("Drop:", draggedIdx, "onto", targetRowIndex);

      if (isNaN(draggedIdx) || draggedIdx === targetRowIndex) {
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
    },
    [matrix, currentHistoryIndex, matrixHistory, onMatrixChange]
  );

  const handleDragEnd = useCallback(() => {
    console.log("Drag end");
    // Re-enable scrolling in case drop didn't fire
    document.body.style.overflow = "";
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

  const handleWeightSort = () => {
    // Helper function to calculate Pauli weight
    const calculateWeight = (row: number[]) => {
      const n = row.length / 2;
      let weight = 0;
      for (let i = 0; i < n; i++) {
        if (row[i] === 1 || row[i + n] === 1) {
          weight++;
        }
      }
      return weight;
    };

    // Create a new matrix with rows sorted by weight (ascending)
    const newMatrix = [...matrix].sort((a, b) => {
      const weightA = calculateWeight(a);
      const weightB = calculateWeight(b);
      return weightA - weightB;
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
      if (isDisabled) {
        return;
      }
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
    [onRowSelectionChange, effectiveSelectedRows, isDisabled]
  );

  const openPCMPanel = usePanelConfigStore((state) => state.openPCMPanel);
  const openSingleLegoPCMPanel = usePanelConfigStore(
    (state) => state.openSingleLegoPCMPanel
  );

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
        <Text>Scalar: {matrix[0][0]}</Text>
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
    selectedRows: effectiveSelectedRows,
    draggedRowIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDragEnd,
    handleRowClick,
    legOrdering,
    onLegHover,
    isDisabled
  };

  // Add a key to force re-render when selection changes
  const listKey = `list-${effectiveSelectedRows.join("-")}-${draggedRowIndex || "none"}`;

  return (
    <Box h="100%" w="100%" display="flex" flexDirection="column" p={4}>
      <HStack mb={0} align="center" justify="space-between">
        <HStack align="left" spacing={0}>
          {popOut && (
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton
                  icon={<FiExternalLink />}
                  aria-label="Pop out PCM panel"
                  size="lg"
                  variant="ghost"
                  onClick={() => {
                    if (signature) {
                      openPCMPanel(signature, "PCM for " + title);
                    } else if (lego) {
                      console.log("Opening single lego PCM panel for", lego);
                      openSingleLegoPCMPanel(
                        lego.instance_id,
                        "PCM for " + title
                      );
                    }
                  }}
                />
              </TooltipTrigger>
              <TooltipPortal>
                <TooltipContent
                  className="bg-gray-900 text-white px-2 py-1 text-sm rounded high-z"
                  sideOffset={5}
                >
                  Pop out PCM panel
                </TooltipContent>
              </TooltipPortal>
            </Tooltip>
          )}

          <Box
            p={3}
            borderBottom="1px"
            borderColor="gray.200"
            cursor={isDisabled ? "not-allowed" : "pointer"}
            onClick={(e) => {
              if (isDisabled || !signature) return;
              const cachedTensorNetwork = getCachedTensorNetwork(signature);
              if (cachedTensorNetwork) {
                setTensorNetwork(cachedTensorNetwork.tensorNetwork);
                focusOnTensorNetwork();
              }
            }}
          >
            <Text fontWeight="bold" fontSize="sm">
              [[{numLegs}, {numLegs - n_stabilizers}]]{" "}
              {matrix.every(isCSS) ? "CSS" : "non-CSS"} stabilizer{" "}
              {numLegs - n_stabilizers > 0 ? " subspace" : " state"}
              {isDisabled && " (inactive)"}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {title}
            </Text>
          </Box>
        </HStack>
        <HStack>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                icon={<FaEllipsisV />}
                variant="outline"
                size="sm"
                aria-label="Matrix actions"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="high-z">
              <DropdownMenuItem
                onClick={handleUndo}
                disabled={isDisabled || currentHistoryIndex <= 0}
              >
                Undo
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleRedo}
                disabled={
                  isDisabled || currentHistoryIndex >= matrixHistory.length - 1
                }
              >
                Redo
              </DropdownMenuItem>
              {onRecalculate && (
                <DropdownMenuItem onClick={onRecalculate} disabled={isDisabled}>
                  Recalculate
                </DropdownMenuItem>
              )}
              {matrix.every(isCSS) && (
                <DropdownMenuItem onClick={handleCSSSort} disabled={isDisabled}>
                  CSS-sort
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={handleWeightSort}
                disabled={isDisabled}
              >
                Sort by weight
              </DropdownMenuItem>
              {/* TODO: Re-enable this when we have a way to re-order legs */}
              {/* {legOrdering && onLegOrderingChange && (
              <DropdownMenuItem onClick={() => setIsLegReorderDialogOpen(true)}>
                Reorder Legs
              </DropdownMenuItem>
            )} */}
              <DropdownMenuItem onClick={copyMatrixAsNumpy}>
                Copy as numpy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyMatrixAsQdistrnd}>
                Copy as qdistrnd
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <IconButton
            icon={<FaDropletSlash />}
            aria-label="Clear highlights"
            size="sm"
            variant="outline"
            onClick={() => {
              onRowSelectionChange?.([]);
            }}
          />
        </HStack>
      </HStack>

      <Box
        position="relative"
        mx={0}
        mt={0}
        style={{ flex: 1, minHeight: 0 }}
        ref={containerRef}
      >
        {/* <Resizable
          size={listSize}
          minWidth={250}
          minHeight={200}
          maxWidth="100vw"
          maxHeight="100vh"
          onResizeStop={(_e, _direction, _ref, d) => {
            setListSize({
              width: listSize.width + d.width,
              height: listSize.height + d.height
            });
          }}
          handleStyles={{
            bottom: {
              background: "#E2E8F0",
              borderTop: "1px solid #CBD5E0",
              height: "8px",
              cursor: "ns-resize"
            },
            right: {
              background: "#E2E8F0",
              borderLeft: "1px solid #CBD5E0",
              width: "8px",
              cursor: "ew-resize"
            },
            bottomRight: {
              background: "#CBD5E0",
              border: "1px solid #A0AEC0",
              borderRadius: "0 0 6px 0",
              width: "12px",
              height: "12px",
              cursor: "nw-resize"
            }
          }}
          handleClasses={{
            bottom: "resize-handle-bottom",
            right: "resize-handle-right",
            bottomRight: "resize-handle-corner"
          }}
          enable={{
            top: false,
            right: true,
            bottom: true,
            left: false,
            topRight: false,
            bottomRight: true,
            bottomLeft: false,
            topLeft: false
          }}
        > */}
        {/* Pauli stabilizer rows - virtualized */}
        <List
          key={listKey}
          height={listSize.height}
          width={listSize.width}
          itemCount={matrix.length}
          itemSize={20}
          itemData={itemData}
          ref={listRef}
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
                selectedRows={data.selectedRows}
                draggedRowIndex={data.draggedRowIndex}
                handleDragStart={data.handleDragStart}
                handleDragOver={data.handleDragOver}
                handleDrop={data.handleDrop}
                handleDragEnd={data.handleDragEnd}
                handleRowClick={data.handleRowClick}
                legOrdering={data.legOrdering}
                isDisabled={data.isDisabled}
              />
            </div>
          )}
        </List>
        {/* 
          
          <Box
            position="absolute"
            bottom="0"
            right="0"
            width="12px"
            height="12px"
            pointerEvents="none"
            zIndex={1}
            opacity={0.6}
            _hover={{ opacity: 1 }}
            transition="opacity 0.2s"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{ transform: "rotate(90deg)" }}
            >
              <path
                d="M9 3L3 9M6 3L3 6M9 6L6 9"
                stroke={SVG_COLORS.I}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Box>
        </Resizable> */}
      </Box>
    </Box>
  );
};

export default ParityCheckMatrixDisplay;
