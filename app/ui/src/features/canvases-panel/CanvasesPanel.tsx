import React, { useMemo, useState } from "react";
import {
  Box,
  VStack,
  Text,
  List,
  ListItem,
  HStack,
  Badge,
  useColorModeValue,
  IconButton,
  useToast,
  Checkbox,
  Button
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import {
  getCanvasIdFromUrl,
  useCanvasStore
} from "../../stores/canvasStateStore";

interface CanvasInfo {
  id: string;
  title: string;
  lastModified: Date;
  legoCount: number;
}

const CanvasesPanel: React.FC = () => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const textColor = useColorModeValue("gray.800", "gray.200");
  const selectedBgColor = useColorModeValue("blue.50", "blue.900");
  const selectedTextColor = useColorModeValue("blue.700", "blue.200");
  const deleteButtonHoverBg = useColorModeValue("red.100", "red.900");
  const currentCanvasTitle = useCanvasStore((state) => state.title);

  const currentCanvasId = getCanvasIdFromUrl();
  const toast = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedCanvases, setSelectedCanvases] = useState<Set<string>>(
    new Set()
  );
  const [_, setIsBulkDeleteMode] = useState(false);

  const savedCanvases = useMemo(() => {
    const canvases: CanvasInfo[] = [];

    // Iterate through localStorage to find all canvas states
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("canvas-state-")) {
        try {
          const canvasId = key.replace("canvas-state-", "");
          const storedData = localStorage.getItem(key);

          if (storedData) {
            const parsedData = JSON.parse(storedData);
            const jsonState = parsedData.state?.jsonState;

            if (jsonState) {
              const canvasState = JSON.parse(jsonState);
              const timestamp = parsedData.state?._timestamp || Date.now();

              canvases.push({
                id: canvasId,
                title: canvasState.title || "Untitled Canvas",
                lastModified: new Date(timestamp),
                legoCount: canvasState.pieces?.length || 0
              });
            }
          }
        } catch (error) {
          console.error(`Error parsing canvas state for key ${key}:`, error);
        }
      }
    }

    // Sort by last modified date (newest first)
    return canvases.sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
    );
  }, [refreshTrigger]);

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return "Just now";
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (diffInHours < 24 * 7) {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleCanvasClick = (canvasId: string) => {
    if (canvasId !== currentCanvasId) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("canvasId", canvasId);
      window.location.href = currentUrl.toString();
    }
  };

  const handleDeleteCanvas = (canvasId: string, canvasTitle: string) => {
    if (canvasId === currentCanvasId) {
      toast({
        title: "Cannot delete current canvas",
        description:
          "Please switch to a different canvas before deleting this one.",
        status: "warning",
        duration: 3000,
        isClosable: true
      });
      return;
    }

    if (
      window.confirm(
        `Are you sure you want to delete "${canvasTitle}"? This action cannot be undone.`
      )
    ) {
      try {
        // Remove from localStorage
        localStorage.removeItem(`canvas-state-${canvasId}`);
        localStorage.removeItem(`canvas-state-${canvasId}-backup`);

        toast({
          title: "Canvas deleted",
          description: `"${canvasTitle}" has been permanently deleted.`,
          status: "success",
          duration: 3000,
          isClosable: true
        });

        // Force re-render by updating the component state
        setRefreshTrigger((prev) => prev + 1);
      } catch (error) {
        toast({
          title: "Error deleting canvas",
          description: "Failed to delete the canvas. Please try again.",
          status: "error",
          duration: 3000,
          isClosable: true
        });
      }
    }
  };

  const handleBulkDelete = () => {
    if (selectedCanvases.size === 0) {
      toast({
        title: "No canvases selected",
        description: "Please select at least one canvas to delete.",
        status: "warning",
        duration: 3000,
        isClosable: true
      });
      return;
    }

    const selectedCanvasTitles = savedCanvases
      .filter((canvas) => selectedCanvases.has(canvas.id))
      .map((canvas) => canvas.title);

    if (
      window.confirm(
        `Are you sure you want to delete ${selectedCanvases.size} canvas${selectedCanvases.size > 1 ? "es" : ""}?\n\n${selectedCanvasTitles.join("\n")}\n\nThis action cannot be undone.`
      )
    ) {
      try {
        let deletedCount = 0;
        let errorCount = 0;

        selectedCanvases.forEach((canvasId) => {
          try {
            localStorage.removeItem(`canvas-state-${canvasId}`);
            localStorage.removeItem(`canvas-state-${canvasId}-backup`);
            deletedCount++;
          } catch (error) {
            errorCount++;
          }
        });

        if (errorCount > 0) {
          toast({
            title: "Partial deletion completed",
            description: `Successfully deleted ${deletedCount} canvas${deletedCount > 1 ? "es" : ""}, but ${errorCount} failed.`,
            status: "warning",
            duration: 5000,
            isClosable: true
          });
        } else {
          toast({
            title: "Bulk deletion completed",
            description: `Successfully deleted ${deletedCount} canvas${deletedCount > 1 ? "es" : ""}.`,
            status: "success",
            duration: 3000,
            isClosable: true
          });
        }

        // Clear selection and refresh
        setSelectedCanvases(new Set());
        setIsBulkDeleteMode(false);
        setRefreshTrigger((prev) => prev + 1);
      } catch (error) {
        toast({
          title: "Error during bulk deletion",
          description: "Failed to delete some canvases. Please try again.",
          status: "error",
          duration: 3000,
          isClosable: true
        });
      }
    }
  };

  const handleCanvasSelection = (canvasId: string, checked: boolean) => {
    const newSelection = new Set(selectedCanvases);
    if (checked) {
      newSelection.add(canvasId);
    } else {
      newSelection.delete(canvasId);
    }
    setSelectedCanvases(newSelection);
  };

  const handleSelectAll = () => {
    const deletableCanvases = savedCanvases.filter(
      (canvas) => canvas.id !== currentCanvasId
    );
    if (selectedCanvases.size === deletableCanvases.length) {
      // If all are selected, deselect all
      setSelectedCanvases(new Set());
    } else {
      // Select all deletable canvases
      setSelectedCanvases(
        new Set(deletableCanvases.map((canvas) => canvas.id))
      );
    }
  };

  return (
    <Box
      bg={bgColor}
      border="1px"
      borderColor={borderColor}
      borderRadius="md"
      p={4}
      height="100%"
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      {/* Bulk Delete Controls */}
      <HStack justify="space-between" mb={3}>
        <HStack spacing={2}>
          <Box
            onClick={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          >
            <Checkbox
              isChecked={selectedCanvases.size > 0}
              isIndeterminate={
                selectedCanvases.size > 0 &&
                selectedCanvases.size <
                  savedCanvases.filter((c) => c.id !== currentCanvasId).length
              }
              onChange={handleSelectAll}
              size="sm"
            >
              Select All
            </Checkbox>
          </Box>
          {selectedCanvases.size > 0 && (
            <Text
              fontSize="sm"
              color={useColorModeValue("gray.600", "gray.400")}
            >
              {selectedCanvases.size} selected
            </Text>
          )}
        </HStack>
        {selectedCanvases.size > 0 && (
          <Button
            size="sm"
            colorScheme="red"
            variant="outline"
            onClick={handleBulkDelete}
            leftIcon={<DeleteIcon />}
          >
            Delete Selected
          </Button>
        )}
      </HStack>

      <VStack spacing={2} flex={1} overflow="auto">
        <List spacing={2} width="100%">
          {savedCanvases.map((canvas) => {
            const isCurrent = canvas.id === currentCanvasId;
            const isSelected = selectedCanvases.has(canvas.id);

            return (
              <ListItem key={canvas.id}>
                <Box
                  p={3}
                  borderRadius="md"
                  bg={
                    isCurrent
                      ? selectedBgColor
                      : isSelected
                        ? useColorModeValue("blue.50", "blue.900")
                        : "transparent"
                  }
                  border={isCurrent ? "1px" : isSelected ? "1px" : "1px"}
                  borderColor={
                    isCurrent
                      ? "blue.200"
                      : isSelected
                        ? "blue.300"
                        : "transparent"
                  }
                  cursor="pointer"
                  _hover={{
                    bg: isCurrent
                      ? selectedBgColor
                      : isSelected
                        ? useColorModeValue("blue.100", "blue.800")
                        : useColorModeValue("gray.50", "gray.700")
                  }}
                  onClick={() => handleCanvasClick(canvas.id)}
                >
                  <VStack align="start" spacing={1}>
                    <HStack justify="space-between" width="100%">
                      <HStack spacing={2} flex={1}>
                        {!isCurrent && (
                          <Box
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onMouseDown={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Checkbox
                              isChecked={isSelected}
                              onChange={(e) => {
                                handleCanvasSelection(
                                  canvas.id,
                                  e.target.checked
                                );
                              }}
                              size="sm"
                            />
                          </Box>
                        )}
                        <Text
                          fontWeight={isCurrent ? "bold" : "normal"}
                          color={isCurrent ? selectedTextColor : textColor}
                          fontSize="sm"
                          noOfLines={1}
                          flex={1}
                        >
                          {isCurrent ? currentCanvasTitle : canvas.title}
                        </Text>
                      </HStack>
                      <HStack spacing={2}>
                        <Badge
                          size="sm"
                          colorScheme={isCurrent ? "blue" : "gray"}
                          variant={isCurrent ? "solid" : "subtle"}
                        >
                          {canvas.legoCount} legos
                        </Badge>
                        {!isCurrent && selectedCanvases.size === 0 && (
                          <IconButton
                            aria-label={`Delete ${canvas.title}`}
                            icon={<DeleteIcon />}
                            size="xs"
                            variant="ghost"
                            colorScheme="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCanvas(canvas.id, canvas.title);
                            }}
                            _hover={{
                              bg: deleteButtonHoverBg
                            }}
                          />
                        )}
                      </HStack>
                    </HStack>
                    <Text
                      fontSize="xs"
                      color={useColorModeValue("gray.500", "gray.400")}
                    >
                      {formatDate(canvas.lastModified)}
                    </Text>
                  </VStack>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </VStack>
    </Box>
  );
};

export default CanvasesPanel;
