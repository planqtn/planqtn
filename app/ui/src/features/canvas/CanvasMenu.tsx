import React from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { FiFile, FiMoreVertical, FiUpload } from "react-icons/fi";
import { TbPlugConnected } from "react-icons/tb";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { usePanelConfigStore } from "../../stores/panelConfigStore";
import { RuntimeConfigService } from "../kernel/runtimeConfigService";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

import { Box, Icon, Text } from "@chakra-ui/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { useUserStore } from "@/stores/userStore";

interface CanvasMenuProps {
  handleExportSvg: () => void;
}

export const CanvasMenu: React.FC<CanvasMenuProps> = ({ handleExportSvg }) => {
  const { currentUser } = useUserStore();
  const { handleClearAll, handleExportPythonCode } = useCanvasStore();

  const setDroppedLegos = useCanvasStore((state) => state.setDroppedLegos);
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const hideConnectedLegs = useCanvasStore((state) => state.hideConnectedLegs);
  const setHideConnectedLegs = useCanvasStore(
    (state) => state.setHideConnectedLegs
  );
  const hideIds = useCanvasStore((state) => state.hideIds);
  const setHideIds = useCanvasStore((state) => state.setHideIds);
  const hideTypeIds = useCanvasStore((state) => state.hideTypeIds);
  const setHideTypeIds = useCanvasStore((state) => state.setHideTypeIds);
  const hideDanglingLegs = useCanvasStore((state) => state.hideDanglingLegs);
  const hideLegLabels = useCanvasStore((state) => state.hideLegLabels);
  const setHideLegLabels = useCanvasStore((state) => state.setHideLegLabels);
  const setHideDanglingLegs = useCanvasStore(
    (state) => state.setHideDanglingLegs
  );
  const showToolbar = usePanelConfigStore((state) => state.showToolbar);
  const setShowToolbar = usePanelConfigStore((state) => state.setShowToolbar);

  const handleRuntimeToggle = useCanvasStore(
    (state) => state.handleRuntimeToggle
  );
  const openWeightEnumeratorDialog = useCanvasStore(
    (state) => state.openWeightEnumeratorDialog
  );
  const openImportCanvasDialog = useCanvasStore(
    (state) => state.openImportCanvasDialog
  );
  const openAboutDialog = useCanvasStore((state) => state.openAboutDialog);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Box
          p={2}
          cursor="pointer"
          _hover={{ bg: "gray.100" }}
          borderRadius="full"
          transition="all 0.2s ease-in-out"
        >
          <Icon as={FiMoreVertical} boxSize={4} />
        </Box>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="high-z">
        <DropdownMenuLabel>
          <Text>Canvas</Text>
        </DropdownMenuLabel>

        <DropdownMenuItem onClick={() => (window.location.href = "/")}>
          <Icon as={FiFile} />
          New Canvas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openImportCanvasDialog}>
          <Icon as={FiUpload} />
          New from JSON file...
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleClearAll}
          disabled={droppedLegos.length === 0}
        >
          Remove all
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const clearedLegos = droppedLegos.map((lego) =>
              lego.with({
                selectedMatrixRows: [],
                highlightedLegConstraints: []
              })
            );
            useCanvasStore.getState().clearAllHighlightedTensorNetworkLegs();
            setDroppedLegos(clearedLegos);
          }}
          disabled={
            !droppedLegos.some(
              (lego) =>
                (lego.selectedMatrixRows &&
                  lego.selectedMatrixRows.length > 0) ||
                lego.highlightedLegConstraints.length > 0
            )
          }
        >
          Clear highlights
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {!tensorNetwork || !currentUser ? (
          <Tooltip delayDuration={0}>
            {" "}
            {/* Set delayDuration to 0 for immediate tooltip */}
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <DropdownMenuItem disabled>
                  Calculate Weight Enumerator {!currentUser ? "🔒" : ""}
                </DropdownMenuItem>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {!tensorNetwork
                ? "No network to calculate weight enumerator"
                : !currentUser
                  ? "Please sign in to calculate weight enumerator"
                  : ""}
            </TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenuItem
            onClick={() => {
              if (tensorNetwork) {
                openWeightEnumeratorDialog(
                  tensorNetwork,
                  useCanvasStore.getState().connections
                );
              }
            }}
          >
            Calculate Weight Enumerator
          </DropdownMenuItem>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Display settings</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="high-z">
              <DropdownMenuCheckboxItem
                onClick={() => {
                  setHideConnectedLegs(!hideConnectedLegs);
                }}
                checked={hideConnectedLegs}
              >
                Hide connected legs
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                onClick={() => {
                  setHideIds(!hideIds);
                }}
                checked={hideIds}
              >
                Hide IDs
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                onClick={() => {
                  setHideTypeIds(!hideTypeIds);
                }}
                checked={hideTypeIds}
              >
                Hide Type IDs
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                onClick={() => {
                  setHideDanglingLegs(!hideDanglingLegs);
                }}
                checked={hideDanglingLegs}
              >
                Hide Dangling Legs
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                onClick={() => {
                  setHideLegLabels(!hideLegLabels);
                }}
                checked={hideLegLabels}
              >
                Hide Leg Labels
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Panel settings</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="high-z">
              <DropdownMenuCheckboxItem
                checked={
                  usePanelConfigStore.getState().buildingBlocksPanelConfig
                    .isOpen
                }
                onClick={() => {
                  const newConfig = new FloatingPanelConfigManager(
                    usePanelConfigStore
                      .getState()
                      .buildingBlocksPanelConfig.toJSON()
                  );
                  newConfig.setIsOpen(
                    !usePanelConfigStore.getState().buildingBlocksPanelConfig
                      .isOpen
                  );
                  usePanelConfigStore
                    .getState()
                    .setBuildingBlocksPanelConfig(newConfig);
                }}
              >
                Show Building Blocks Panel
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={
                  usePanelConfigStore.getState().detailsPanelConfig.isOpen
                }
                onClick={() => {
                  const newConfig = new FloatingPanelConfigManager(
                    usePanelConfigStore.getState().detailsPanelConfig.toJSON()
                  );
                  newConfig.setIsOpen(
                    !usePanelConfigStore.getState().detailsPanelConfig.isOpen
                  );
                  usePanelConfigStore
                    .getState()
                    .setDetailsPanelConfig(newConfig);
                }}
              >
                Show Details Panel
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={
                  usePanelConfigStore.getState().canvasesPanelConfig.isOpen
                }
                onClick={() => {
                  const newConfig = new FloatingPanelConfigManager(
                    usePanelConfigStore.getState().canvasesPanelConfig.toJSON()
                  );
                  newConfig.setIsOpen(
                    !usePanelConfigStore.getState().canvasesPanelConfig.isOpen
                  );
                  usePanelConfigStore
                    .getState()
                    .setCanvasesPanelConfig(newConfig);
                }}
              >
                Show Canvases Panel
              </DropdownMenuCheckboxItem>

              {/* <DropdownMenuCheckboxItem
                checked={usePanelConfigStore.getState().taskPanelConfig.isOpen}
                onClick={() => {
                  const newConfig = new FloatingPanelConfigManager(
                    usePanelConfigStore.getState().taskPanelConfig.toJSON()
                  );
                  newConfig.setIsOpen(
                    !usePanelConfigStore.getState().taskPanelConfig.isOpen
                  );
                  usePanelConfigStore.getState().setTaskPanelConfig(newConfig);
                }}
              >
                Show Task Panel
              </DropdownMenuCheckboxItem> */}
              <DropdownMenuCheckboxItem
                checked={
                  usePanelConfigStore.getState().subnetsPanelConfig.isOpen
                }
                onClick={() => {
                  const newConfig = new FloatingPanelConfigManager(
                    usePanelConfigStore.getState().subnetsPanelConfig.toJSON()
                  );
                  newConfig.setIsOpen(
                    !usePanelConfigStore.getState().subnetsPanelConfig.isOpen
                  );
                  usePanelConfigStore
                    .getState()
                    .setSubnetsPanelConfig(newConfig);
                }}
              >
                Show Subnets Panel
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={showToolbar}
                onClick={() => setShowToolbar(!showToolbar)}
              >
                Show Floating Toolbar
              </DropdownMenuCheckboxItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleRuntimeToggle}>
          <Icon as={TbPlugConnected} />
          <Text>
            Switch runtime to{" "}
            {RuntimeConfigService.isLocalRuntime() ? "cloud" : "local"}
          </Text>
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Export...</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="high-z">
              <DropdownMenuItem onClick={handleExportSvg}>
                Export canvas as SVG...
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPythonCode}>
                Export network as Python code
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={openAboutDialog}>
          About PlanqTN
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
