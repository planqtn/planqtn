import React from "react";
import { Box, Icon, useColorModeValue, HStack } from "@chakra-ui/react";
import { QuestionIcon } from "@chakra-ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { usePanelConfigStore } from "../../stores/panelConfigStore";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

import {
  FaFolderTree,
  FaInfo,
  FaLayerGroup,
  FaCubes,
  FaWrench
} from "react-icons/fa6";

interface FloatingPanelsToolbarProps {
  className?: string;
}

export const FloatingPanelsToolbar: React.FC<FloatingPanelsToolbarProps> = ({
  className
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBgColor = useColorModeValue("gray.100", "gray.700");
  const activeBgColor = useColorModeValue("blue.100", "blue.700");

  // Panel configurations from store
  const buildingBlocksPanelConfig = usePanelConfigStore(
    (state) => state.buildingBlocksPanelConfig
  );
  const setBuildingBlocksPanelConfig = usePanelConfigStore(
    (state) => state.setBuildingBlocksPanelConfig
  );

  const detailsPanelConfig = usePanelConfigStore(
    (state) => state.detailsPanelConfig
  );
  const setDetailsPanelConfig = usePanelConfigStore(
    (state) => state.setDetailsPanelConfig
  );

  const canvasesPanelConfig = usePanelConfigStore(
    (state) => state.canvasesPanelConfig
  );
  const setCanvasesPanelConfig = usePanelConfigStore(
    (state) => state.setCanvasesPanelConfig
  );

  const subnetsPanelConfig = usePanelConfigStore(
    (state) => state.subnetsPanelConfig
  );
  const setSubnetsPanelConfig = usePanelConfigStore(
    (state) => state.setSubnetsPanelConfig
  );

  // const taskPanelConfig = usePanelConfigStore((state) => state.taskPanelConfig);
  // const setTaskPanelConfig = usePanelConfigStore(
  //   (state) => state.setTaskPanelConfig
  // );

  // Canvas store for showToolbar setting
  const showToolbar = usePanelConfigStore((state) => state.showToolbar);
  const setShowToolbar = usePanelConfigStore((state) => state.setShowToolbar);
  const nextZIndex = usePanelConfigStore((state) => state.nextZIndex);

  // Help dialog functionality
  const openHelpDialog = useCanvasStore((state) => state.openHelpDialog);

  // Helper function to toggle panel
  const togglePanel = (
    currentConfig: FloatingPanelConfigManager,
    setConfig: (config: FloatingPanelConfigManager) => void
  ) => {
    const newConfig = new FloatingPanelConfigManager(currentConfig.toJSON());
    newConfig.setZIndex(nextZIndex);
    usePanelConfigStore.setState((state) => {
      state.nextZIndex = nextZIndex + 1;
    });
    newConfig.setIsOpen(!currentConfig.isOpen);

    setConfig(newConfig);
  };

  // Handle help button click
  const handleHelpClick = () => {
    openHelpDialog(
      "/docs/planqtn-studio/ui-controls/#panel-toolbar",
      "Panel Toolbar Help"
    );
  };

  return (
    <Box
      className={className}
      position="absolute"
      top={2}
      left={12} // Position next to the canvas menu
      zIndex={2000}
      bg={bgColor}
      borderWidth={1}
      borderColor={borderColor}
      borderRadius="md"
      boxShadow="md"
      p={1}
    >
      <HStack spacing={1}>
        {/* Building Blocks Panel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Box
              bg={
                buildingBlocksPanelConfig.isOpen ? activeBgColor : "transparent"
              }
              borderRadius="md"
              px={2}
              py={2}
              opacity={0.8}
              _hover={{
                opacity: 1,
                bg: buildingBlocksPanelConfig.isOpen
                  ? activeBgColor
                  : hoverBgColor
              }}
              transition="all 0.2s"
              cursor="pointer"
              onClick={() =>
                togglePanel(
                  buildingBlocksPanelConfig,
                  setBuildingBlocksPanelConfig
                )
              }
              alignItems="center"
              display="flex"
            >
              <Icon as={FaCubes} boxSize={4} />
            </Box>
          </TooltipTrigger>
          <TooltipContent className="high-z">
            Building Blocks Panel
          </TooltipContent>
        </Tooltip>

        {/* Canvases Panel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Box
              bg={canvasesPanelConfig.isOpen ? activeBgColor : "transparent"}
              borderRadius="md"
              px={2}
              py={2}
              opacity={0.8}
              _hover={{
                opacity: 1,
                bg: canvasesPanelConfig.isOpen ? activeBgColor : hoverBgColor
              }}
              transition="all 0.2s"
              cursor="pointer"
              onClick={() =>
                togglePanel(canvasesPanelConfig, setCanvasesPanelConfig)
              }
              alignItems="center"
              display="flex"
            >
              <Icon as={FaLayerGroup} boxSize={4} />
            </Box>
          </TooltipTrigger>
          <TooltipContent className="high-z">Canvases Panel</TooltipContent>
        </Tooltip>

        {/* Details Panel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Box
              bg={detailsPanelConfig.isOpen ? activeBgColor : "transparent"}
              borderRadius="md"
              px={2}
              py={2}
              opacity={0.8}
              _hover={{
                opacity: 1,
                bg: detailsPanelConfig.isOpen ? activeBgColor : hoverBgColor
              }}
              transition="all 0.2s"
              cursor="pointer"
              onClick={() =>
                togglePanel(detailsPanelConfig, setDetailsPanelConfig)
              }
              alignItems="center"
              display="flex"
            >
              <Icon as={FaInfo} boxSize={4} />
            </Box>
          </TooltipTrigger>
          <TooltipContent className="high-z">Details Panel</TooltipContent>
        </Tooltip>

        {/* Subnets Panel */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Box
              bg={subnetsPanelConfig.isOpen ? activeBgColor : "transparent"}
              borderRadius="md"
              px={2}
              py={2}
              opacity={0.8}
              _hover={{
                opacity: 1,
                bg: subnetsPanelConfig.isOpen ? activeBgColor : hoverBgColor
              }}
              transition="all 0.2s"
              cursor="pointer"
              onClick={() =>
                togglePanel(subnetsPanelConfig, setSubnetsPanelConfig)
              }
              alignItems="center"
              display="flex"
            >
              <Icon as={FaFolderTree} boxSize={4} />
            </Box>
          </TooltipTrigger>
          <TooltipContent className="high-z">Subnets Panel</TooltipContent>
        </Tooltip>

        {/* Task Panel */}
        {/* <Tooltip>
          <TooltipTrigger asChild>
            <Box
              bg={taskPanelConfig.isOpen ? activeBgColor : "transparent"}
              borderRadius="md"
              px={2}
              py={2}
              opacity={0.8}
              _hover={{
                opacity: 1,
                bg: taskPanelConfig.isOpen ? activeBgColor : hoverBgColor
              }}
              transition="all 0.2s"
              cursor="pointer"
              onClick={() => togglePanel(taskPanelConfig, setTaskPanelConfig)}
              alignItems="center"
              display="flex"
            >
              <Icon as={FaBarsProgress} boxSize={4} />
            </Box>
          </TooltipTrigger>
          <TooltipContent className="high-z">Task Panel</TooltipContent>
        </Tooltip> */}

        {/* Show Toolbar Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Box
              bg={showToolbar ? activeBgColor : "transparent"}
              borderRadius="md"
              px={2}
              py={2}
              opacity={0.8}
              _hover={{
                opacity: 1,
                bg: showToolbar ? activeBgColor : hoverBgColor
              }}
              transition="all 0.2s"
              cursor="pointer"
              onClick={() => setShowToolbar(!showToolbar)}
              alignItems="center"
              display="flex"
            >
              <Icon as={FaWrench} boxSize={4} />
            </Box>
          </TooltipTrigger>
          <TooltipContent className="high-z">
            Show Floating Toolbar
          </TooltipContent>
        </Tooltip>

        {/* Help Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Box
              bg="transparent"
              borderRadius="md"
              px={2}
              py={2}
              opacity={0.8}
              _hover={{
                opacity: 1,
                bg: hoverBgColor
              }}
              transition="all 0.2s"
              cursor="pointer"
              onClick={handleHelpClick}
              alignItems="center"
              display="flex"
            >
              <Icon as={QuestionIcon} boxSize={4} />
            </Box>
          </TooltipTrigger>
          <TooltipContent className="high-z">Panel Toolbar Help</TooltipContent>
        </Tooltip>
      </HStack>
    </Box>
  );
};
