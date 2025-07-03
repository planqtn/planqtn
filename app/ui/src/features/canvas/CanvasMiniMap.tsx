import React, { useEffect, useRef, useState, useCallback } from "react";
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

export const CanvasMiniMap: React.FC = () => {
  const canvasRef = useCanvasStore((state) => state.canvasRef);
  const handleWheelEvent = useCanvasStore((state) => state.handleWheelEvent);
  const [isExpanded, setIsExpanded] = useState(true);

  const mapRef = useRef<HTMLDivElement>(null);
  const schematicRef = useRef<HTMLDivElement>(null);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const schematicBg = useColorModeValue("gray.50", "gray.700");
  const viewportColor = useColorModeValue("blue.400", "blue.300");
  const droppedLegoBoundingColor = useColorModeValue("gray.600", "gray.400");
  const tensorNetworkBoundingColor = useColorModeValue(
    "orange.500",
    "orange.400"
  );

  // Use new viewport system from canvasUI store
  const {
    viewport,
    droppedLegoBoundingBox,
    tensorNetworkBoundingBox,
    setCanvasPanelDimensions: setPanelDimensions,
    setZoomToMouse,
    setPanOffset,
    viewport: { zoomLevel }
  } = useCanvasStore();

  // Also track selection state for reactivity
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const selectedLegoIds =
    tensorNetwork?.legos?.map((lego) => lego.instanceId) || [];

  // Track canvas panel dimensions
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

  // Calculate minimap dimensions and positions
  const minimapBounds = React.useMemo(() => {
    // Use dropped lego bounding box as the reference area, with fallback to viewport
    const contentBounds = droppedLegoBoundingBox || {
      minX: viewport.logicalPanOffset.x,
      minY: viewport.logicalPanOffset.y,
      maxX: viewport.logicalPanOffset.x + viewport.logicalWidth,
      maxY: viewport.logicalPanOffset.y + viewport.logicalHeight,
      width: viewport.logicalWidth,
      height: viewport.logicalHeight
    };

    // Add padding around content
    const padding = 100;
    const paddedBounds = {
      minX: contentBounds.minX - padding,
      minY: contentBounds.minY - padding,
      maxX: contentBounds.maxX + padding,
      maxY: contentBounds.maxY + padding,
      width: contentBounds.width + 2 * padding,
      height: contentBounds.height + 2 * padding
    };

    // Calculate viewport position as percentage of padded bounds
    const viewportX = Math.max(
      0,
      Math.min(
        100,
        ((viewport.logicalPanOffset.x - paddedBounds.minX) /
          paddedBounds.width) *
          100
      )
    );
    const viewportY = Math.max(
      0,
      Math.min(
        100,
        ((viewport.logicalPanOffset.y - paddedBounds.minY) /
          paddedBounds.height) *
          100
      )
    );

    // Calculate viewport size as percentage
    const viewportWidthPercent = Math.max(
      5,
      Math.min(80, (viewport.logicalWidth / paddedBounds.width) * 100)
    );
    const viewportHeightPercent = Math.max(
      5,
      Math.min(80, (viewport.logicalHeight / paddedBounds.height) * 100)
    );

    // Calculate content bounding box position (without padding)
    const contentBoxX =
      ((contentBounds.minX - paddedBounds.minX) / paddedBounds.width) * 100;
    const contentBoxY =
      ((contentBounds.minY - paddedBounds.minY) / paddedBounds.height) * 100;
    const contentBoxWidth = (contentBounds.width / paddedBounds.width) * 100;
    const contentBoxHeight = (contentBounds.height / paddedBounds.height) * 100;

    // Calculate tensor network bounding box if it exists
    let tensorNetworkBox = null;
    if (tensorNetworkBoundingBox) {
      tensorNetworkBox = {
        x:
          ((tensorNetworkBoundingBox.minX - paddedBounds.minX) /
            paddedBounds.width) *
          100,
        y:
          ((tensorNetworkBoundingBox.minY - paddedBounds.minY) /
            paddedBounds.height) *
          100,
        width: (tensorNetworkBoundingBox.width / paddedBounds.width) * 100,
        height: (tensorNetworkBoundingBox.height / paddedBounds.height) * 100
      };
    }

    return {
      paddedBounds,
      viewportX,
      viewportY,
      viewportWidthPercent,
      viewportHeightPercent,
      contentBoxX,
      contentBoxY,
      contentBoxWidth,
      contentBoxHeight,
      tensorNetworkBox
    };
  }, [
    viewport,
    droppedLegoBoundingBox,
    tensorNetworkBoundingBox,
    selectedLegoIds
  ]);

  // Handle viewport dragging
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });

  const handleSchematicMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (schematicRef.current) {
        setIsDraggingViewport(true);
        const rect = schematicRef.current.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

        // Calculate offset from mouse to viewport top-left corner
        const offsetX = mouseX - minimapBounds.viewportX;
        const offsetY = mouseY - minimapBounds.viewportY;
        setDragStartOffset({ x: offsetX, y: offsetY });
      }
    },
    [minimapBounds.viewportX, minimapBounds.viewportY]
  );

  const handleSchematicMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDraggingViewport && schematicRef.current) {
        const rect = schematicRef.current.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 100;
        const mouseY = ((e.clientY - rect.top) / rect.height) * 100;

        // Calculate new viewport position using the initial offset
        const newViewportX = Math.max(
          0,
          Math.min(
            100 - minimapBounds.viewportWidthPercent,
            mouseX - dragStartOffset.x
          )
        );
        const newViewportY = Math.max(
          0,
          Math.min(
            100 - minimapBounds.viewportHeightPercent,
            mouseY - dragStartOffset.y
          )
        );

        // Convert percentage back to canvas coordinates
        const newCanvasX =
          minimapBounds.paddedBounds.minX +
          (newViewportX / 100) * minimapBounds.paddedBounds.width;
        const newCanvasY =
          minimapBounds.paddedBounds.minY +
          (newViewportY / 100) * minimapBounds.paddedBounds.height;

        // Update pan offset
        setPanOffset(new LogicalPoint(-newCanvasX, -newCanvasY));
      }
    },
    [isDraggingViewport, dragStartOffset, minimapBounds, setPanOffset]
  );

  const handleSchematicMouseUp = useCallback(() => {
    setIsDraggingViewport(false);
    setDragStartOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (isDraggingViewport) {
      document.addEventListener("mouseup", handleSchematicMouseUp);
      return () =>
        document.removeEventListener("mouseup", handleSchematicMouseUp);
    }
  }, [isDraggingViewport, handleSchematicMouseUp]);

  // Handle mouse wheel zoom with zoom-to-mouse
  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", handleWheelEvent, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheelEvent);
  }, [canvasRef, handleWheelEvent]);

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    const newZoomLevel = Math.min(zoomLevel * 1.2, 9);

    // Use stable center point calculation
    let centerPoint;
    if (
      droppedLegoBoundingBox &&
      droppedLegoBoundingBox.width > 0 &&
      droppedLegoBoundingBox.height > 0
    ) {
      // Center on content if available
      centerPoint = {
        x: droppedLegoBoundingBox.minX + droppedLegoBoundingBox.width / 2,
        y: droppedLegoBoundingBox.minY + droppedLegoBoundingBox.height / 2
      };
    } else {
      // Use logical canvas center as fallback
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
    const newZoomLevel = Math.max(zoomLevel * 0.8, 0.04);

    // Use stable center point calculation
    let centerPoint;
    if (
      droppedLegoBoundingBox &&
      droppedLegoBoundingBox.width > 0 &&
      droppedLegoBoundingBox.height > 0
    ) {
      // Center on content if available
      centerPoint = new LogicalPoint(
        droppedLegoBoundingBox.minX + droppedLegoBoundingBox.width / 2,
        droppedLegoBoundingBox.minY + droppedLegoBoundingBox.height / 2
      );
    } else {
      // Use logical canvas center as fallback
      centerPoint = viewport.logicalCenter;
    }

    setZoomToMouse(
      newZoomLevel,
      new LogicalPoint(centerPoint.x, centerPoint.y)
    );
  }, [zoomLevel, viewport, setZoomToMouse, droppedLegoBoundingBox]);

  const handleZoomReset = useCallback(() => {
    // Use a stable center point for zoom reset to avoid extreme coordinate issues
    let centerPoint;

    if (
      droppedLegoBoundingBox &&
      droppedLegoBoundingBox.width > 0 &&
      droppedLegoBoundingBox.height > 0
    ) {
      // Center on the content if legos exist
      centerPoint = new LogicalPoint(
        droppedLegoBoundingBox.minX + droppedLegoBoundingBox.width / 2,
        droppedLegoBoundingBox.minY + droppedLegoBoundingBox.height / 2
      );
    } else {
      // Fallback to canvas center in logical coordinates (center of the coordinate system)
      centerPoint = new LogicalPoint(
        viewport.logicalWidth / 2,
        viewport.logicalHeight / 2
      );
    }

    // Safety check for valid center point
    if (!isFinite(centerPoint.x) || !isFinite(centerPoint.y)) {
      console.warn(
        "Invalid center point in zoom reset, using fallback:",
        centerPoint
      );
      centerPoint = new LogicalPoint(
        viewport.logicalWidth / 2,
        viewport.logicalHeight / 2
      );
    }

    setZoomToMouse(1, centerPoint);
  }, [viewport, setZoomToMouse, droppedLegoBoundingBox]);

  const handleToggle = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

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
      minWidth="180px"
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
        <VStack p={2} spacing={2} align="stretch">
          {/* Schematic viewport representation */}
          <Box>
            <Box
              ref={schematicRef}
              width="100%"
              height="60px"
              bg={schematicBg}
              border="1px solid"
              borderColor={borderColor}
              borderRadius="sm"
              position="relative"
              cursor={isDraggingViewport ? "grabbing" : "grab"}
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
                opacity={0.2}
                backgroundImage="radial-gradient(circle, currentColor 1px, transparent 1px)"
                backgroundSize="8px 8px"
                color="gray.400"
              />

              {/* Content bounding box (light gray rectangle showing where all legos are) */}
              {droppedLegoBoundingBox && (
                <Box
                  position="absolute"
                  left={`${Math.max(0, Math.min(100, minimapBounds.contentBoxX))}%`}
                  top={`${Math.max(0, Math.min(100, minimapBounds.contentBoxY))}%`}
                  width={`${Math.max(1, Math.min(100, minimapBounds.contentBoxWidth))}%`}
                  height={`${Math.max(1, Math.min(100, minimapBounds.contentBoxHeight))}%`}
                  bg={droppedLegoBoundingColor}
                  opacity={0.3}
                  borderRadius="1px"
                />
              )}

              {/* Tensor network bounding box (darker rectangle for selected legos) */}
              {minimapBounds.tensorNetworkBox && (
                <Box
                  position="absolute"
                  left={`${Math.max(0, Math.min(100, minimapBounds.tensorNetworkBox.x))}%`}
                  top={`${Math.max(0, Math.min(100, minimapBounds.tensorNetworkBox.y))}%`}
                  width={`${Math.max(1, Math.min(100, minimapBounds.tensorNetworkBox.width))}%`}
                  height={`${Math.max(1, Math.min(100, minimapBounds.tensorNetworkBox.height))}%`}
                  border="2px solid"
                  borderColor={tensorNetworkBoundingColor}
                  bg={`${tensorNetworkBoundingColor}20`}
                  borderRadius="1px"
                />
              )}

              {/* Movable viewport indicator (blue rectangle) */}
              <Box
                position="absolute"
                left={`${minimapBounds.viewportX}%`}
                top={`${minimapBounds.viewportY}%`}
                width={`${minimapBounds.viewportWidthPercent}%`}
                height={`${minimapBounds.viewportHeightPercent}%`}
                border="2px solid"
                borderColor={viewportColor}
                bg={`${viewportColor}20`}
                borderRadius="2px"
                transition={isDraggingViewport ? "none" : "all 0.1s ease"}
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
