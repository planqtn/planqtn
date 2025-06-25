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
import TaskPanel from "./TaskPanel";

interface FloatingTaskPanelProps {
  user?: { id: string } | null;
  onError: (error: string) => void;
  onClose: () => void;
  isOpen: boolean;
}

const FloatingTaskPanel: React.FC<FloatingTaskPanelProps> = ({
  user,
  onError,
  onClose,
  isOpen
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const shadowColor = useColorModeValue("lg", "dark-lg");

  // Panel position and size state
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  // Save panel position and size to localStorage
  const saveLayout = useCallback(() => {
    const layout = { position, size };
    localStorage.setItem("floatingTaskPanelLayout", JSON.stringify(layout));
  }, [position, size]);

  // Load panel position and size from localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem("floatingTaskPanelLayout");
    if (savedLayout) {
      try {
        const layout = JSON.parse(savedLayout);
        if (layout.position) setPosition(layout.position);
        if (layout.size) setSize(layout.size);
      } catch (error) {
        console.error("Failed to load panel layout:", error);
      }
    }
  }, []);

  // Save layout when position or size changes
  useEffect(() => {
    saveLayout();
  }, [saveLayout]);

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
        const maxX = window.innerWidth - size.width;
        const maxY = window.innerHeight - size.height;

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY))
        });
      } else if (isResizing) {
        const newWidth = Math.max(300, e.clientX - position.x);
        const newHeight = Math.max(200, e.clientY - position.y);

        // Constrain to viewport
        const maxWidth = window.innerWidth - position.x;
        const maxHeight = window.innerHeight - position.y;

        setSize({
          width: Math.min(newWidth, maxWidth),
          height: Math.min(newHeight, maxHeight)
        });
      }
    },
    [isDragging, isResizing, dragOffset, position, size]
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
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;

      setPosition((prev) => ({
        x: Math.max(0, Math.min(prev.x, maxX)),
        y: Math.max(0, Math.min(prev.y, maxY))
      }));
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [size]);

  if (!isOpen) return null;

  return (
    <Box
      ref={panelRef}
      position="fixed"
      left={`${position.x}px`}
      top={`${position.y}px`}
      width={`${size.width}px`}
      height={`${size.height}px`}
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
        bg={useColorModeValue("gray.50", "gray.700")}
        borderTopRadius="lg"
        cursor="grab"
        _active={{ cursor: "grabbing" }}
        onMouseDown={handleDragStart}
        userSelect="none"
      >
        <DragHandleIcon />
        <Text fontSize="sm" fontWeight="bold" flex={1}>
          Tasks
        </Text>
        <IconButton
          aria-label="Close panel"
          icon={<CloseIcon />}
          size="sm"
          variant="ghost"
          onClick={onClose}
          _hover={{ bg: useColorModeValue("gray.200", "gray.600") }}
        />
      </HStack>

      {/* Scrollable content area */}
      <Box flex={1} overflow="auto" p={0}>
        <TaskPanel user={user} onError={onError} floatingMode />
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
        color={useColorModeValue("gray.400", "gray.500")}
        _hover={{ color: useColorModeValue("gray.600", "gray.300") }}
      >
        <RiDragMove2Fill size={14} />
      </Box>
    </Box>
  );
};

export default FloatingTaskPanel;
