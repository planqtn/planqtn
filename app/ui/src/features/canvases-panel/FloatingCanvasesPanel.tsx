import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Box,
  IconButton,
  HStack,
  Text,
  useColorModeValue
} from "@chakra-ui/react";
import { CloseIcon, DragHandleIcon } from "@chakra-ui/icons";
import { RiDragMove2Fill } from "react-icons/ri";
import CanvasesPanel from "./CanvasesPanel";
import { useCanvasStore } from "../../stores/canvasStateStore";

interface FloatingCanvasesPanelProps {
  onClose: () => void;
  isOpen: boolean;
}

const FloatingCanvasesPanel: React.FC<FloatingCanvasesPanelProps> = ({
  onClose,
  isOpen
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const shadowColor = useColorModeValue("lg", "dark-lg");
  const headerBgColor = useColorModeValue("gray.50", "gray.700");
  const closeButtonHoverBg = useColorModeValue("gray.200", "gray.600");
  const resizeHandleColor = useColorModeValue("gray.400", "gray.500");
  const resizeHandleHoverColor = useColorModeValue("gray.600", "gray.300");

  // Panel position and size state from store
  const layout = useCanvasStore((state) => state.canvasesPanelLayout);
  const setLayout = useCanvasStore((state) => state.setCanvasesPanelLayout);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Update store when layout changes
  const updateLayout = useCallback(
    (newLayout: {
      position: { x: number; y: number };
      size: { width: number; height: number };
    }) => {
      setLayout(newLayout);
    },
    [setLayout]
  );

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!panelRef.current) return;

    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
  }, []);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  }, []);

  // Handle mouse move for drag and resize
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // Constrain to viewport
        const maxX = window.innerWidth - layout.size.width;
        const maxY = window.innerHeight - layout.size.height;

        updateLayout({
          position: {
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
          },
          size: layout.size
        });
      } else if (isResizing) {
        const newWidth = Math.max(250, e.clientX - layout.position.x);
        const newHeight = Math.max(300, e.clientY - layout.position.y);

        // Constrain to viewport
        const maxWidth = window.innerWidth - layout.position.x;
        const maxHeight = window.innerHeight - layout.position.y;

        updateLayout({
          position: layout.position,
          size: {
            width: Math.min(newWidth, maxWidth),
            height: Math.min(newHeight, maxHeight)
          }
        });
      }
    },
    [isDragging, isResizing, dragOffset, layout, updateLayout]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Handle window resize to keep panel in bounds
  useEffect(() => {
    const handleWindowResize = () => {
      const maxX = window.innerWidth - layout.size.width;
      const maxY = window.innerHeight - layout.size.height;

      updateLayout({
        position: {
          x: Math.max(0, Math.min(layout.position.x, maxX)),
          y: Math.max(0, Math.min(layout.position.y, maxY))
        },
        size: layout.size
      });
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [layout, updateLayout]);

  if (!isOpen) return null;

  return (
    <Box
      ref={panelRef}
      position="fixed"
      left={`${layout.position.x}px`}
      top={`${layout.position.y}px`}
      width={`${layout.size.width}px`}
      height={`${layout.size.height}px`}
      bg={bgColor}
      border="1px"
      borderColor={borderColor}
      borderRadius="lg"
      boxShadow={shadowColor}
      zIndex={1000}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      cursor={isDragging ? "grabbing" : "default"}
    >
      {/* Header with drag handle */}
      <HStack
        p={3}
        borderBottom="1px"
        borderColor={borderColor}
        bg={headerBgColor}
        borderTopRadius="lg"
        cursor="grab"
        _active={{ cursor: "grabbing" }}
        onMouseDown={handleDragStart}
        userSelect="none"
      >
        <DragHandleIcon />
        <Text fontSize="sm" fontWeight="bold" flex={1}>
          Navigator
        </Text>
        <IconButton
          aria-label="Close panel"
          icon={<CloseIcon />}
          size="sm"
          variant="ghost"
          onClick={onClose}
          _hover={{ bg: closeButtonHoverBg }}
        />
      </HStack>

      {/* Content area with scrolling */}
      <Box flex={1} overflow="auto" p={0}>
        <CanvasesPanel />
      </Box>

      {/* Resize handle */}
      <Box
        ref={resizeHandleRef}
        position="absolute"
        bottom={0}
        right={0}
        width="20px"
        height="20px"
        cursor="nw-resize"
        onMouseDown={handleResizeStart}
        display="flex"
        alignItems="center"
        justifyContent="center"
        color={resizeHandleColor}
        _hover={{ color: resizeHandleHoverColor }}
      >
        <RiDragMove2Fill size={14} />
      </Box>
    </Box>
  );
};

export default FloatingCanvasesPanel;
