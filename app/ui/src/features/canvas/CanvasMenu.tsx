import React from "react";
import {
  Box,
  Button,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuItemOption,
  MenuList,
  useColorModeValue,
  MenuDivider,
  HStack,
  Text
} from "@chakra-ui/react";
import { FiMoreVertical } from "react-icons/fi";
import { TbPlugConnected } from "react-icons/tb";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { RuntimeConfigService } from "../kernel/runtimeConfigService";
import { Connection } from "../../stores/connectionStore";
import { TensorNetwork } from "../../lib/TensorNetwork";
import { User } from "@supabase/supabase-js";
import { ImperativePanelHandle } from "react-resizable-panels";

interface CanvasMenuProps {
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  isLegoPanelCollapsed: boolean;
  isTaskPanelCollapsed: boolean;
  setIsTaskPanelCollapsed: (collapsed: boolean) => void;
  leftPanelRef: React.RefObject<ImperativePanelHandle | null>;
  handleClearAll: () => void;
  handleExportPythonCode: () => void;
  handleExportSvg: () => void;
  handleRuntimeToggle: () => void;
  openWeightEnumeratorDialog: (
    tensorNetwork: TensorNetwork,
    connections: Connection[]
  ) => void;
  currentUser: User | null;
}

export const CanvasMenu: React.FC<CanvasMenuProps> = ({
  zoomLevel,
  setZoomLevel,
  isLegoPanelCollapsed,
  isTaskPanelCollapsed,
  setIsTaskPanelCollapsed,
  leftPanelRef,
  handleClearAll,
  handleExportPythonCode,
  handleExportSvg,
  handleRuntimeToggle,
  openWeightEnumeratorDialog,
  currentUser
}) => {
  const setDroppedLegos = useCanvasStore((state) => state.setDroppedLegos);
  const hideConnectedLegs = useCanvasStore((state) => state.hideConnectedLegs);
  const setHideConnectedLegs = useCanvasStore(
    (state) => state.setHideConnectedLegs
  );
  return (
    <Box
      position="absolute"
      top={2}
      left={2}
      zIndex={20}
      bg={useColorModeValue("white", "gray.800")}
      borderRadius="md"
      boxShadow="md"
      p={1}
    >
      <Menu>
        {({ isOpen }) => (
          <>
            <MenuButton as={Button} variant="ghost" size="sm" minW="auto" p={2}>
              <Icon as={FiMoreVertical} boxSize={4} />
            </MenuButton>
            {isOpen && (
              <MenuList>
                <MenuItem
                  onClick={() => {
                    const tensorNetwork =
                      useCanvasStore.getState().tensorNetwork;
                    if (tensorNetwork) {
                      openWeightEnumeratorDialog(
                        tensorNetwork,
                        useCanvasStore.getState().connections
                      );
                    }
                  }}
                  isDisabled={
                    !useCanvasStore.getState().tensorNetwork || !currentUser
                  }
                  title={
                    !useCanvasStore.getState().tensorNetwork
                      ? "No network to calculate weight enumerator"
                      : !currentUser
                        ? "Please sign in to calculate weight enumerator"
                        : ""
                  }
                >
                  Calculate Weight Enumerator
                </MenuItem>
                <MenuItem
                  onClick={handleExportPythonCode}
                  isDisabled={!useCanvasStore.getState().tensorNetwork}
                >
                  Export network as Python code
                </MenuItem>
                <MenuDivider />
                <MenuItemOption
                  onClick={() => {
                    setHideConnectedLegs(!hideConnectedLegs);
                  }}
                  isChecked={hideConnectedLegs}
                >
                  Hide connected legs
                </MenuItemOption>
                <MenuItemOption
                  isChecked={isLegoPanelCollapsed}
                  onClick={() => {
                    if (leftPanelRef.current) {
                      if (isLegoPanelCollapsed) {
                        leftPanelRef.current.expand();
                      } else {
                        leftPanelRef.current.collapse();
                      }
                    }
                  }}
                >
                  Hide Building Blocks Panel
                </MenuItemOption>
                <MenuItemOption
                  isChecked={isTaskPanelCollapsed}
                  onClick={() => {
                    setIsTaskPanelCollapsed(!isTaskPanelCollapsed);
                  }}
                >
                  Hide Task Panel
                </MenuItemOption>
                <MenuItem
                  onClick={() => {
                    setZoomLevel(1);
                  }}
                  isDisabled={zoomLevel === 1}
                >
                  Reset zoom
                </MenuItem>
                <MenuDivider />
                <MenuItem onClick={handleClearAll}>Remove all</MenuItem>
                <MenuItem
                  onClick={() => {
                    const droppedLegos = useCanvasStore.getState().droppedLegos;
                    const clearedLegos = droppedLegos.map((lego) =>
                      lego.with({ selectedMatrixRows: [] })
                    );
                    setDroppedLegos(clearedLegos);
                  }}
                  isDisabled={
                    !useCanvasStore
                      .getState()
                      .droppedLegos.some(
                        (lego) =>
                          lego.selectedMatrixRows &&
                          lego.selectedMatrixRows.length > 0
                      )
                  }
                >
                  Clear highlights
                </MenuItem>
                <MenuDivider />
                <MenuItem onClick={handleRuntimeToggle}>
                  <HStack spacing={2}>
                    <Icon as={TbPlugConnected} />
                    <Text>
                      Switch runtime to{" "}
                      {RuntimeConfigService.isLocalRuntime()
                        ? "cloud"
                        : "local"}
                    </Text>
                  </HStack>
                </MenuItem>
                <MenuDivider />
                <MenuItem onClick={handleExportSvg}>
                  Export canvas as SVG...
                </MenuItem>
              </MenuList>
            )}
          </>
        )}
      </Menu>
    </Box>
  );
};
