import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo
} from "react";
import {
  Box,
  Text,
  IconButton,
  Collapse,
  VStack,
  HStack,
  useColorModeValue,
  Tooltip
} from "@chakra-ui/react";
import {
  ChevronUpIcon,
  ChevronDownIcon,
  AddIcon,
  MinusIcon,
  QuestionIcon,
  RepeatIcon
} from "@chakra-ui/icons";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { LogicalPoint } from "../../types/coordinates";

const MINIMAP_WIDTH = 80;
const MINIMAP_HEIGHT = 60;
const PADDING = 50; // logical units
const MIN_MINIMAP_PADDING = 10; // px, minimum padding in minimap

export const CanvasMiniMap: React.FC = () => {
  const canvasRef = useCanvasStore((state) => state.canvasRef);
  const handleWheelEvent = useCanvasStore((state) => state.handleWheelEvent);
  const [isExpanded, setIsExpanded] = useState(true);

  const mapRef = useRef<HTMLDivElement>(null);
  const schematicRef = useRef<HTMLDivElement>(null);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const viewportColor = useColorModeValue("blue.400", "blue.300");
  const droppedLegoBoundingColor = useColorModeValue("gray.600", "gray.400");
  const tensorNetworkBoundingColor = useColorModeValue(
    "orange.500",
    "orange.400"
  );
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);

  const viewport = useCanvasStore((state) => state.viewport);
  const zoomLevel = viewport.zoomLevel;
  const calculateDroppedLegoBoundingBox = useCanvasStore(
    (state) => state.calculateDroppedLegoBoundingBox
  );
  const calculateTensorNetworkBoundingBox = useCanvasStore(
    (state) => state.calculateTensorNetworkBoundingBox
  );

  const setPanelDimensions = useCanvasStore(
    (state) => state.setCanvasPanelDimensions
  );

  const setZoomToMouse = useCanvasStore((state) => state.setZoomToMouse);
  const setPanOffset = useCanvasStore((state) => state.setPanOffset);

  useEffect(() => {
    const updateDimensions = () => {
      const canvasRect = canvasRef?.current?.getBoundingClientRect();
      if (canvasRect) {
        setPanelDimensions(canvasRect.width, canvasRect.height);
      }
    };

    updateDimensions();

    // Listen for resize events
    const resizeObserver = new ResizeObserver(updateDimensions);
    if (canvasRef?.current) {
      resizeObserver.observe(canvasRef?.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [canvasRef, setPanelDimensions]);

  const droppedLegoBoundingBox = calculateDroppedLegoBoundingBox();
  const tensorNetworkBoundingBox =
    tensorNetwork && tensorNetwork.legos.length > 0
      ? calculateTensorNetworkBoundingBox()
      : null;

  // Calculate minimap dimensions and positions (in pixels)
  const minimap = useMemo(() => {
    // 1. Compute content bounds (with padding)
    const contentBounds = droppedLegoBoundingBox || {
      minX: viewport.logicalPanOffset.x,
      minY: viewport.logicalPanOffset.y,
      maxX: viewport.logicalPanOffset.x + viewport.logicalWidth,
      maxY: viewport.logicalPanOffset.y + viewport.logicalHeight
    };
    const paddedContent = {
      minX: contentBounds.minX - PADDING,
      minY: contentBounds.minY - PADDING,
      maxX: contentBounds.maxX + PADDING,
      maxY: contentBounds.maxY + PADDING
    };
    // 2. Compute viewport bounds
    const viewportBounds = {
      minX: viewport.logicalPanOffset.x,
      minY: viewport.logicalPanOffset.y,
      maxX: viewport.logicalPanOffset.x + viewport.logicalWidth,
      maxY: viewport.logicalPanOffset.y + viewport.logicalHeight
    };
    // 3. Compute union bounds, align with viewport if viewport is larger
    let minX = Math.min(paddedContent.minX, viewportBounds.minX);
    let maxX = Math.max(paddedContent.maxX, viewportBounds.maxX);
    let minY = Math.min(paddedContent.minY, viewportBounds.minY);
    let maxY = Math.max(paddedContent.maxY, viewportBounds.maxY);
    const viewportWidth = viewport.logicalWidth;
    const viewportHeight = viewport.logicalHeight;
    // For X
    if (viewportWidth > maxX - minX) {
      minX = viewportBounds.minX;
      maxX = viewportBounds.maxX;
    }
    // For Y
    if (viewportHeight > maxY - minY) {
      minY = viewportBounds.minY;
      maxY = viewportBounds.maxY;
    }
    // 4. Use these for minimap scaling and mapping
    let logicalWidth = maxX - minX;
    let logicalHeight = maxY - minY;
    let scale = Math.min(
      MINIMAP_WIDTH / logicalWidth,
      MINIMAP_HEIGHT / logicalHeight
    );
    // 5. Ensure minimum padding in minimap pixels
    // Compute current padding in minimap px
    const leftPadPx = (paddedContent.minX - minX) * scale;
    const rightPadPx = (maxX - paddedContent.maxX) * scale;
    const topPadPx = (paddedContent.minY - minY) * scale;
    const bottomPadPx = (maxY - paddedContent.maxY) * scale;
    // If any padding is less than MIN_MINIMAP_PADDING, expand bounds
    if (leftPadPx < MIN_MINIMAP_PADDING) {
      minX = paddedContent.minX - MIN_MINIMAP_PADDING / scale;
    }
    if (rightPadPx < MIN_MINIMAP_PADDING) {
      maxX = paddedContent.maxX + MIN_MINIMAP_PADDING / scale;
    }
    if (topPadPx < MIN_MINIMAP_PADDING) {
      minY = paddedContent.minY - MIN_MINIMAP_PADDING / scale;
    }
    if (bottomPadPx < MIN_MINIMAP_PADDING) {
      maxY = paddedContent.maxY + MIN_MINIMAP_PADDING / scale;
    }
    // Recompute scale after expanding bounds
    logicalWidth = maxX - minX;
    logicalHeight = maxY - minY;
    scale = Math.min(
      MINIMAP_WIDTH / logicalWidth,
      MINIMAP_HEIGHT / logicalHeight
    );
    // Helper to map logical to minimap px
    const toMini = (x: number, y: number) => ({
      x: (x - minX) * scale,
      y: (y - minY) * scale
    });
    // Viewport
    const vpTopLeft = toMini(
      viewport.logicalPanOffset.x,
      viewport.logicalPanOffset.y
    );
    const vpBotRight = toMini(
      viewport.logicalPanOffset.x + viewport.logicalWidth,
      viewport.logicalPanOffset.y + viewport.logicalHeight
    );
    // Content bounding box
    const contentRect = droppedLegoBoundingBox
      ? {
          ...toMini(droppedLegoBoundingBox.minX, droppedLegoBoundingBox.minY),
          w:
            (droppedLegoBoundingBox.maxX - droppedLegoBoundingBox.minX) * scale,
          h: (droppedLegoBoundingBox.maxY - droppedLegoBoundingBox.minY) * scale
        }
      : null;
    // Selection bounding box
    const selectionRect = tensorNetworkBoundingBox
      ? {
          ...toMini(
            tensorNetworkBoundingBox.minX,
            tensorNetworkBoundingBox.minY
          ),
          w:
            (tensorNetworkBoundingBox.maxX - tensorNetworkBoundingBox.minX) *
            scale,
          h:
            (tensorNetworkBoundingBox.maxY - tensorNetworkBoundingBox.minY) *
            scale
        }
      : null;
    return {
      scale,
      toMini,
      vpRect: {
        x: vpTopLeft.x,
        y: vpTopLeft.y,
        w: vpBotRight.x - vpTopLeft.x,
        h: vpBotRight.y - vpTopLeft.y
      },
      contentRect,
      selectionRect
    };
  }, [droppedLegoBoundingBox, tensorNetworkBoundingBox, viewport]);

  // Drag logic
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  const handleSchematicMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (schematicRef.current) {
        const rect = schematicRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        // Check if inside viewport rect
        if (
          mx >= minimap.vpRect.x &&
          mx <= minimap.vpRect.x + minimap.vpRect.w &&
          my >= minimap.vpRect.y &&
          my <= minimap.vpRect.y + minimap.vpRect.h
        ) {
          setDragging(true);
          dragOffset.current = {
            x: mx - minimap.vpRect.x,
            y: my - minimap.vpRect.y
          };
        }
      }
    },
    [minimap, droppedLegoBoundingBox, viewport, setPanOffset]
  );

  const handleSchematicMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging && schematicRef.current) {
        const rect = schematicRef.current.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        // Clamp viewport inside minimap
        const newMiniX = Math.min(
          MINIMAP_WIDTH - minimap.vpRect.w,
          mx - (dragOffset.current?.x ?? 0)
        );
        const newMiniY = Math.min(
          MINIMAP_HEIGHT - minimap.vpRect.h,
          my - (dragOffset.current?.y ?? 0)
        );
        // Convert back to logical
        const lx =
          newMiniX / minimap.scale +
          (droppedLegoBoundingBox
            ? droppedLegoBoundingBox.minX - PADDING
            : viewport.logicalPanOffset.x);
        const ly =
          newMiniY / minimap.scale +
          (droppedLegoBoundingBox
            ? droppedLegoBoundingBox.minY - PADDING
            : viewport.logicalPanOffset.y);
        setPanOffset(new LogicalPoint(lx, ly));
      }
    },
    [dragging, minimap, droppedLegoBoundingBox, viewport, setPanOffset]
  );

  const handleSchematicMouseUp = useCallback(() => {
    setDragging(false);
    dragOffset.current = null;
  }, []);

  useEffect(() => {
    if (dragging) {
      document.addEventListener("mouseup", handleSchematicMouseUp);
      return () =>
        document.removeEventListener("mouseup", handleSchematicMouseUp);
    }
  }, [dragging, handleSchematicMouseUp]);

  // Handle mouse wheel zoom with zoom-to-mouse
  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheelEvent, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheelEvent);
  }, [canvasRef, handleWheelEvent]);

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    const newZoomLevel = Math.min(zoomLevel * 1.05, 9);
    let centerPoint;
    if (
      droppedLegoBoundingBox &&
      droppedLegoBoundingBox.maxX > droppedLegoBoundingBox.minX &&
      droppedLegoBoundingBox.maxY > droppedLegoBoundingBox.minY
    ) {
      centerPoint = {
        x:
          droppedLegoBoundingBox.minX +
          (droppedLegoBoundingBox.maxX - droppedLegoBoundingBox.minX) / 2,
        y:
          droppedLegoBoundingBox.minY +
          (droppedLegoBoundingBox.maxY - droppedLegoBoundingBox.minY) / 2
      };
    } else {
      centerPoint = {
        x: viewport.logicalWidth / 2,
        y: viewport.logicalHeight / 2
      };
    }
    setZoomToMouse(
      newZoomLevel,
      new LogicalPoint(centerPoint.x, centerPoint.y)
    );
  }, [zoomLevel, viewport, setZoomToMouse, droppedLegoBoundingBox]);

  const handleZoomOut = useCallback(() => {
    const newZoomLevel = Math.max(zoomLevel * 0.95, 0.04);
    let centerPoint;
    if (
      droppedLegoBoundingBox &&
      droppedLegoBoundingBox.maxX > droppedLegoBoundingBox.minX &&
      droppedLegoBoundingBox.maxY > droppedLegoBoundingBox.minY
    ) {
      centerPoint = {
        x:
          droppedLegoBoundingBox.minX +
          (droppedLegoBoundingBox.maxX - droppedLegoBoundingBox.minX) / 2,
        y:
          droppedLegoBoundingBox.minY +
          (droppedLegoBoundingBox.maxY - droppedLegoBoundingBox.minY) / 2
      };
    } else {
      centerPoint = viewport.logicalCenter;
    }
    setZoomToMouse(
      newZoomLevel,
      new LogicalPoint(centerPoint.x, centerPoint.y)
    );
  }, [zoomLevel, viewport, setZoomToMouse, droppedLegoBoundingBox]);

  const handleZoomReset = useCallback(() => {
    let centerPoint;
    if (
      droppedLegoBoundingBox &&
      droppedLegoBoundingBox.maxX > droppedLegoBoundingBox.minX &&
      droppedLegoBoundingBox.maxY > droppedLegoBoundingBox.minY
    ) {
      centerPoint = {
        x:
          droppedLegoBoundingBox.minX +
          (droppedLegoBoundingBox.maxX - droppedLegoBoundingBox.minX) / 2,
        y:
          droppedLegoBoundingBox.minY +
          (droppedLegoBoundingBox.maxY - droppedLegoBoundingBox.minY) / 2
      };
    } else {
      centerPoint = {
        x: viewport.logicalWidth / 2,
        y: viewport.logicalHeight / 2
      };
    }
    setZoomToMouse(1, new LogicalPoint(centerPoint.x, centerPoint.y));
  }, [viewport, setZoomToMouse, droppedLegoBoundingBox]);

  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const mouseInViewport = useCallback(
    (e: React.MouseEvent) => {
      return (
        e.clientX >= minimap.vpRect.x &&
        e.clientX <= minimap.vpRect.x + minimap.vpRect.w &&
        e.clientY >= minimap.vpRect.y &&
        e.clientY <= minimap.vpRect.y + minimap.vpRect.h
      );
    },
    [minimap]
  );

  const zoomPercentage = Math.round(zoomLevel * 100);

  return (
    <Box
      ref={mapRef}
      position="absolute"
      bottom="12px"
      right="12px"
      bg={bgColor}
      border="1px solid"
      borderColor={borderColor}
      borderRadius="md"
      boxShadow="lg"
      zIndex={1000}
      minWidth={`${MINIMAP_WIDTH + 20}px`}
    >
      {/* Header with toggle button and help icon */}
      <HStack
        p={2}
        borderBottom={isExpanded ? "1px solid" : "none"}
        borderColor={borderColor}
        justify="space-between"
        cursor="pointer"
        onClick={handleToggle}
        _hover={{ bg: useColorModeValue("gray.50", "gray.700") }}
      >
        <HStack spacing={2}>
          <Text fontSize="sm" fontWeight="medium">
            Canvas Map - {zoomPercentage}%
          </Text>
          <Tooltip
            label="Ctrl+Scroll to zoom • Drag viewport"
            fontSize="xs"
            placement="top"
            hasArrow
          >
            <Box>
              <QuestionIcon
                boxSize={3}
                color="gray.400"
                cursor="help"
                onClick={(e) => e.stopPropagation()}
              />
            </Box>
          </Tooltip>
        </HStack>
        <IconButton
          aria-label={isExpanded ? "Collapse map" : "Expand map"}
          icon={isExpanded ? <ChevronDownIcon /> : <ChevronUpIcon />}
          size="xs"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleToggle();
          }}
        />
      </HStack>

      {/* Collapsible content */}
      <Collapse in={isExpanded} animateOpacity>
        <VStack p={2} spacing={2} align="center">
          {/* Schematic viewport representation */}
          <Box>
            <Box
              ref={schematicRef}
              width={`${MINIMAP_WIDTH}px`}
              height={`${MINIMAP_HEIGHT}px`}
              borderRadius="sm"
              position="relative"
              cursor={
                !mouseInViewport ? "default" : dragging ? "grabbing" : "grab"
              }
              onMouseDown={handleSchematicMouseDown}
              onMouseMove={handleSchematicMouseMove}
            >
              {/* Canvas background representation (light grid) */}
              <Box
                position="absolute"
                top="0"
                left="0"
                width="100%"
                height="100%"
                border="none"
              />

              {/* Content bounding box (light gray rectangle showing where all legos are) */}
              {minimap.contentRect && (
                <Box
                  position="absolute"
                  left={`${minimap.contentRect.x}px`}
                  top={`${minimap.contentRect.y}px`}
                  width={`${minimap.contentRect.w}px`}
                  height={`${minimap.contentRect.h}px`}
                  bg={droppedLegoBoundingColor}
                  opacity={0.3}
                  borderRadius="1px"
                />
              )}

              {/* Tensor network bounding box (darker rectangle for selected legos) */}
              {minimap.selectionRect && (
                <Box
                  position="absolute"
                  left={`${minimap.selectionRect.x}px`}
                  top={`${minimap.selectionRect.y}px`}
                  width={`${minimap.selectionRect.w}px`}
                  height={`${minimap.selectionRect.h}px`}
                  border="2px solid"
                  borderColor={tensorNetworkBoundingColor}
                  bg={`${tensorNetworkBoundingColor}20`}
                  borderRadius="1px"
                />
              )}

              {/* Movable viewport indicator (blue rectangle) */}
              <Box
                position="absolute"
                left={`${minimap.vpRect.x}px`}
                top={`${minimap.vpRect.y}px`}
                width={`${minimap.vpRect.w}px`}
                height={`${minimap.vpRect.h}px`}
                border="2px solid"
                borderColor={viewportColor}
                bg={`${viewportColor}20`}
                borderRadius="2px"
                transition={dragging ? "none" : "all 0.1s ease"}
              />
            </Box>
          </Box>

          {/* Zoom level display with controls */}
          <VStack spacing={1}>
            <HStack spacing={1}>
              <Text fontSize="xs" color="gray.500">
                Zoom
              </Text>
              <IconButton
                aria-label="Reset zoom to 100%"
                icon={<RepeatIcon />}
                size="xs"
                variant="outline"
                onClick={handleZoomReset}
                title="Reset zoom to 100%"
              />
            </HStack>
            <HStack spacing={1}>
              <IconButton
                aria-label="Zoom out"
                icon={<MinusIcon />}
                size="xs"
                variant="outline"
                onClick={handleZoomOut}
                isDisabled={zoomPercentage <= 4}
              />
              <Text
                fontSize="md"
                fontWeight="bold"
                minWidth="40px"
                textAlign="center"
                onClick={handleZoomReset}
                cursor="pointer"
              >
                {zoomPercentage}%
              </Text>
              <IconButton
                aria-label="Zoom in"
                icon={<AddIcon />}
                size="xs"
                variant="outline"
                onClick={handleZoomIn}
                isDisabled={zoomPercentage >= 900}
              />
            </HStack>
          </VStack>
        </VStack>
      </Collapse>
    </Box>
  );
};
