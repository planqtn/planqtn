import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  ReactNode
} from "react";
import {
  Box,
  IconButton,
  HStack,
  Text,
  useColorModeValue,
  Icon
} from "@chakra-ui/react";
import {
  CloseIcon,
  DragHandleIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  QuestionIcon
} from "@chakra-ui/icons";
import { RiDragMove2Fill } from "react-icons/ri";
import { FloatingPanelConfigManager, PanelLayout } from "./FloatingPanelConfig";
import { usePanelConfigStore } from "../../stores/panelConfigStore";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { IconType } from "react-icons/lib";

interface FloatingPanelWrapperProps {
  config: FloatingPanelConfigManager;
  title: string;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
  children: ReactNode;
  showCollapseButton?: boolean;
  showResizeHandle?: boolean;
  icon?: IconType;
  showHelpButton?: boolean;
  helpUrl?: string;
  helpTitle?: string;
}

const FloatingPanelWrapper: React.FC<FloatingPanelWrapperProps> = ({
  config,
  title,
  onConfigChange,
  onClose,
  children,
  showCollapseButton = true,
  showResizeHandle = true,
  icon,
  showHelpButton = false,
  helpUrl,
  helpTitle
}) => {
  // Safety check: ensure config has valid layout data
  const safeConfig = useMemo(() => {
    if (
      !config ||
      !config.layout ||
      !config.layout.position ||
      !config.layout.size
    ) {
      // Create a safe fallback config
      const fallbackConfig = new FloatingPanelConfigManager({
        id: config?.id || "fallback",
        title: config?.title || title,
        isOpen: config?.isOpen ?? false,
        isCollapsed: config?.isCollapsed ?? false,
        layout: {
          position: { x: 100, y: 100 },
          size: { width: 300, height: 400 }
        },
        zIndex: config?.zIndex || 1000
      });

      // Update the parent with the safe config
      setTimeout(() => onConfigChange(fallbackConfig), 0);
      return fallbackConfig;
    }
    return config;
  }, [config, title, onConfigChange]);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const shadowColor = useColorModeValue("lg", "dark-lg");
  const headerBgColor = useColorModeValue("gray.50", "gray.700");
  const closeButtonHoverBg = useColorModeValue("gray.200", "gray.600");
  const resizeHandleColor = useColorModeValue("gray.400", "gray.500");
  const resizeHandleHoverColor = useColorModeValue("gray.600", "gray.300");

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const nextZIndex = usePanelConfigStore((state) => state.nextZIndex);
  const openHelpDialog = useCanvasStore((state) => state.openHelpDialog);

  // Function to bring panel to front
  const bringToFront = useCallback(() => {
    const newConfig = new FloatingPanelConfigManager({
      ...safeConfig.toJSON(),
      zIndex: nextZIndex
    });
    onConfigChange(newConfig);
    // Increment the nextZIndex in the store
    usePanelConfigStore.setState((state) => {
      state.nextZIndex++;
    });
  }, [safeConfig, nextZIndex, onConfigChange]);

  // Add DOM-level click listener for more reliable click detection
  useEffect(() => {
    const panelElement = panelRef.current;
    if (!panelElement) return;

    const handlePanelClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Allow double-click events to pass through for renaming functionality
      if (e.detail >= 2) {
        return;
      }

      // Don't bring to front if clicking on interactive elements
      if (
        target.closest(
          'button, input, textarea, select, a, [role="button"], [tabindex], [type="checkbox"], [type="radio"], svg, [data-resize-handle], [data-testid*="button"], [data-testid*="icon"]'
        )
      ) {
        return;
      }

      // Don't bring to front if clicking on elements with cursor pointer (likely interactive)
      // Check the clicked element and all its parents
      let currentElement: HTMLElement | null = target;
      while (currentElement) {
        const computedStyle = window.getComputedStyle(currentElement);
        if (computedStyle.cursor === "pointer") {
          return;
        }
        currentElement = currentElement.parentElement;
      }

      bringToFront();
    };

    panelElement.addEventListener("click", handlePanelClick, true); // Use capture phase

    return () => {
      panelElement.removeEventListener("click", handlePanelClick, true);
    };
  }, [bringToFront]);

  // Handle panel click to bring to front
  const handlePanelClick = useCallback(
    (e: React.MouseEvent) => {
      // Allow double-click events to pass through for renaming functionality
      if (e.detail >= 2) {
        return;
      }

      // Don't bring to front if clicking on buttons or resize handle
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("[data-resize-handle]")) {
        return;
      }

      // Don't bring to front if clicking on interactive elements
      if (
        target.closest(
          'input, textarea, select, a, [role="button"], [tabindex], [type="checkbox"], [type="radio"], svg, [data-testid*="button"], [data-testid*="icon"]'
        )
      ) {
        return;
      }

      // Don't bring to front if clicking on elements with cursor pointer (likely interactive)
      // Check the clicked element and all its parents
      let currentElement: HTMLElement | null = target;
      while (currentElement) {
        const computedStyle = window.getComputedStyle(currentElement);
        if (computedStyle.cursor === "pointer") {
          return;
        }
        currentElement = currentElement.parentElement;
      }

      bringToFront();
    },
    [bringToFront]
  );

  // Handle panel mousedown to bring to front (more reliable than click)
  const handlePanelMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Allow double-click events to pass through for renaming functionality
      if (e.detail >= 2) {
        return;
      }

      // Don't bring to front if clicking on buttons or resize handle
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("[data-resize-handle]")) {
        return;
      }

      // Don't bring to front if clicking on interactive elements
      if (
        target.closest(
          'input, textarea, select, a, [role="button"], [tabindex], [type="checkbox"], [type="radio"], svg, [data-testid*="button"], [data-testid*="icon"]'
        )
      ) {
        return;
      }

      // Don't bring to front if clicking on elements with cursor pointer (likely interactive)
      // Check the clicked element and all its parents
      let currentElement: HTMLElement | null = target;
      while (currentElement) {
        const computedStyle = window.getComputedStyle(currentElement);
        if (computedStyle.cursor === "pointer") {
          return;
        }
        currentElement = currentElement.parentElement;
      }

      // Bring to front on mousedown for more reliable detection
      bringToFront();
    },
    [bringToFront]
  );

  // Update config when layout changes
  const updateLayout = useCallback(
    (newLayout: PanelLayout) => {
      const newConfig = new FloatingPanelConfigManager({
        ...safeConfig.toJSON(),
        layout: newLayout
      });
      onConfigChange(newConfig);
    },
    [safeConfig, onConfigChange]
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!panelRef.current) return;

      // Bring panel to front when starting to drag
      bringToFront();

      const rect = panelRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    },
    [bringToFront]
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Bring panel to front when starting to resize
      bringToFront();

      setIsResizing(true);
    },
    [bringToFront]
  );

  // Handle mouse move for drag and resize
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragOffset.x;
        const newY = e.clientY - dragOffset.y;

        // When collapsed, allow positioning anywhere (just constrain to header size)
        // When expanded, constrain to viewport with full panel size
        const effectiveWidth = safeConfig.isCollapsed
          ? 200
          : safeConfig.layout.size.width;
        const effectiveHeight = safeConfig.isCollapsed
          ? 50
          : safeConfig.layout.size.height;

        const maxX = window.innerWidth - effectiveWidth;
        const maxY = window.innerHeight - effectiveHeight;

        updateLayout({
          position: {
            x: Math.max(0, Math.min(newX, maxX)),
            y: Math.max(0, Math.min(newY, maxY))
          },
          size: safeConfig.layout.size
        });
      } else if (isResizing) {
        const newWidth = Math.max(
          safeConfig.minWidth,
          e.clientX - safeConfig.layout.position.x
        );
        const newHeight = Math.max(
          safeConfig.minHeight,
          e.clientY - safeConfig.layout.position.y
        );

        // Constrain to viewport
        const maxWidth = window.innerWidth - safeConfig.layout.position.x;
        const maxHeight = window.innerHeight - safeConfig.layout.position.y;

        updateLayout({
          position: safeConfig.layout.position,
          size: {
            width: Math.min(newWidth, maxWidth),
            height: Math.min(newHeight, maxHeight)
          }
        });
      }
    },
    [isDragging, isResizing, dragOffset, safeConfig, updateLayout]
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
      const newConfig = new FloatingPanelConfigManager(safeConfig.toJSON());

      // When collapsed, only constrain to header size
      // When expanded, constrain to full panel size
      if (safeConfig.isCollapsed) {
        newConfig.constrainToViewportCollapsed();
      } else {
        newConfig.constrainToViewport();
      }

      onConfigChange(newConfig);
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [safeConfig, onConfigChange]);

  // Handle help button click
  const handleHelpClick = useCallback(() => {
    if (helpUrl) {
      openHelpDialog(helpUrl, helpTitle || `${title} Help`);
    }
  }, [helpUrl, helpTitle, title, openHelpDialog]);

  // Handle collapse toggle
  const handleToggleCollapse = useCallback(() => {
    const newConfig = new FloatingPanelConfigManager(safeConfig.toJSON());
    const wasCollapsed = safeConfig.isCollapsed;
    newConfig.setIsCollapsed(!wasCollapsed);

    // If expanding, ensure the panel has enough space
    if (wasCollapsed) {
      const currentPos = safeConfig.layout.position;
      const panelWidth = safeConfig.layout.size.width;
      const panelHeight = safeConfig.layout.size.height;

      // Check if panel would go outside viewport when expanded
      const maxX = window.innerWidth - panelWidth;
      const maxY = window.innerHeight - panelHeight;

      let newX = currentPos.x;
      let newY = currentPos.y;

      // Adjust position if needed to keep panel fully visible
      if (currentPos.x > maxX) {
        newX = maxX;
      }
      if (currentPos.y > maxY) {
        newY = maxY;
      }

      // Ensure minimum position
      newX = Math.max(0, newX);
      newY = Math.max(0, newY);

      newConfig.updatePosition({ x: newX, y: newY });
    }

    onConfigChange(newConfig);
  }, [safeConfig, onConfigChange]);

  if (!safeConfig.isOpen) return null;

  return (
    <Box
      ref={panelRef}
      position="fixed"
      left={`${safeConfig.layout.position.x}px`}
      top={`${safeConfig.layout.position.y}px`}
      width={`${safeConfig.layout.size.width}px`}
      height={
        safeConfig.isCollapsed ? "auto" : `${safeConfig.layout.size.height}px`
      }
      bg={bgColor}
      border="1px"
      borderColor={borderColor}
      borderRadius="lg"
      boxShadow={shadowColor}
      zIndex={safeConfig.zIndex}
      display="flex"
      flexDirection="column"
      overflow="hidden"
      cursor={isDragging ? "grabbing" : "default"}
      onClick={handlePanelClick}
      onMouseDown={handlePanelMouseDown}
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
        {icon && <Icon as={icon} />}
        <Text fontSize="sm" fontWeight="bold" flex={1}>
          {title}
        </Text>
        {showCollapseButton && (
          <IconButton
            aria-label={
              safeConfig.isCollapsed ? "Expand panel" : "Collapse panel"
            }
            icon={
              safeConfig.isCollapsed ? <ChevronDownIcon /> : <ChevronUpIcon />
            }
            size="sm"
            variant="ghost"
            onClick={handleToggleCollapse}
            _hover={{ bg: closeButtonHoverBg }}
          />
        )}
        {showHelpButton && helpUrl && (
          <IconButton
            aria-label="Help"
            icon={<QuestionIcon />}
            size="sm"
            variant="ghost"
            onClick={handleHelpClick}
            _hover={{ bg: closeButtonHoverBg }}
          />
        )}
        <IconButton
          aria-label="Close panel"
          icon={<CloseIcon />}
          size="sm"
          variant="ghost"
          onClick={onClose}
          _hover={{ bg: closeButtonHoverBg }}
        />
      </HStack>

      {/* Content area with scrolling - clicking anywhere here brings panel to front */}
      {!safeConfig.isCollapsed && (
        <Box
          flex={1}
          overflow="auto"
          p={0}
          onClick={(e) => {
            // Allow double-click events to pass through for renaming functionality
            if (e.detail >= 2) {
              return;
            }

            // Always bring to front when clicking on the content area
            // unless clicking on interactive elements
            const target = e.target as HTMLElement;

            if (
              target.closest(
                'button, input, textarea, select, a, [role="button"], [tabindex], [type="checkbox"], [type="radio"], svg, [data-testid*="button"], [data-testid*="icon"]'
              )
            ) {
              return;
            }

            // Don't bring to front if clicking on elements with cursor pointer (likely interactive)
            // Check the clicked element and all its parents
            let currentElement: HTMLElement | null = target;
            while (currentElement) {
              const computedStyle = window.getComputedStyle(currentElement);
              if (computedStyle.cursor === "pointer") {
                return;
              }
              currentElement = currentElement.parentElement;
            }

            bringToFront();
          }}
          onMouseDown={(e) => {
            // Allow double-click events to pass through for renaming functionality
            if (e.detail >= 2) {
              return;
            }

            // Also handle mousedown for more immediate response
            const target = e.target as HTMLElement;

            if (
              target.closest(
                'button, input, textarea, select, a, [role="button"], [tabindex], [type="checkbox"], [type="radio"], svg, [data-testid*="button"], [data-testid*="icon"]'
              )
            ) {
              return;
            }

            // Don't bring to front if clicking on elements with cursor pointer (likely interactive)
            // Check the clicked element and all its parents
            let currentElement: HTMLElement | null = target;
            while (currentElement) {
              const computedStyle = window.getComputedStyle(currentElement);
              if (computedStyle.cursor === "pointer") {
                return;
              }
              currentElement = currentElement.parentElement;
            }

            bringToFront();
          }}
        >
          {children}
        </Box>
      )}

      {/* Resize handle */}
      {showResizeHandle && !config.isCollapsed && (
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
          data-resize-handle
        >
          <RiDragMove2Fill size={14} />
        </Box>
      )}
    </Box>
  );
};

export default FloatingPanelWrapper;
