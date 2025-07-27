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
import { FiMoreVertical, FiUpload } from "react-icons/fi";
import { TbPlugConnected } from "react-icons/tb";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { useModalStore } from "../../stores/modalStore";
import { RuntimeConfigService } from "../kernel/runtimeConfigService";
import { Connection } from "../../stores/connectionStore";
import { TensorNetwork } from "../../lib/TensorNetwork";
import { User } from "@supabase/supabase-js";
import { ImperativePanelHandle } from "react-resizable-panels";
import { Box, Icon, Text } from "@chakra-ui/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

interface CanvasMenuProps {
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

  const { openImportCanvasDialog, openAboutDialog } = useModalStore();

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

      <DropdownMenuContent>
        <DropdownMenuLabel>
          <Text>Canvas</Text>
        </DropdownMenuLabel>

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
            useCanvasStore.getState().highlightTensorNetworkLegs([]);
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
            <DropdownMenuSubContent>
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
            <DropdownMenuSubContent>
              <DropdownMenuCheckboxItem
                checked={isLegoPanelCollapsed}
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
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={isTaskPanelCollapsed}
                onClick={() => {
                  setIsTaskPanelCollapsed(!isTaskPanelCollapsed);
                }}
              >
                Hide Task Panel
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
            <DropdownMenuSubContent>
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
