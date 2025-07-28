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
  useToast
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { getCanvasIdFromUrl } from "../../stores/canvasStateStore";

interface CanvasInfo {
  id: string;
  title: string;
  lastModified: Date;
  legoCount: number;
}

const NavigatorPanel: React.FC = () => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const textColor = useColorModeValue("gray.800", "gray.200");
  const selectedBgColor = useColorModeValue("blue.50", "blue.900");
  const selectedTextColor = useColorModeValue("blue.700", "blue.200");
  const deleteButtonHoverBg = useColorModeValue("red.100", "red.900");

  const currentCanvasId = getCanvasIdFromUrl();
  const toast = useToast();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
      <VStack spacing={2} flex={1} overflow="auto">
        <List spacing={2} width="100%">
          {savedCanvases.map((canvas) => {
            const isCurrent = canvas.id === currentCanvasId;

            return (
              <ListItem key={canvas.id}>
                <Box
                  p={3}
                  borderRadius="md"
                  bg={isCurrent ? selectedBgColor : "transparent"}
                  border={isCurrent ? "1px" : "1px"}
                  borderColor={isCurrent ? "blue.200" : "transparent"}
                  cursor="pointer"
                  _hover={{
                    bg: isCurrent
                      ? selectedBgColor
                      : useColorModeValue("gray.50", "gray.700")
                  }}
                  onClick={() => handleCanvasClick(canvas.id)}
                >
                  <VStack align="start" spacing={1}>
                    <HStack justify="space-between" width="100%">
                      <Text
                        fontWeight={isCurrent ? "bold" : "normal"}
                        color={isCurrent ? selectedTextColor : textColor}
                        fontSize="sm"
                        noOfLines={1}
                        flex={1}
                      >
                        {canvas.title}
                      </Text>
                      <HStack spacing={2}>
                        <Badge
                          size="sm"
                          colorScheme={isCurrent ? "blue" : "gray"}
                          variant={isCurrent ? "solid" : "subtle"}
                        >
                          {canvas.legoCount} legos
                        </Badge>
                        {!isCurrent && (
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

export default NavigatorPanel;
