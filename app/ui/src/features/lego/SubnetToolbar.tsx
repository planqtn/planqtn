import React, { useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  BarChart3,
  Table,
  Split,
  Scissors,
  Network,
  Link,
  Trash2
} from "lucide-react";
import { FaDropletSlash, FaMinimize, FaYinYang } from "react-icons/fa6";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { BoundingBox } from "../../stores/canvasUISlice";
import "./SubnetToolbar.css";
import { canDoChangeColor } from "@/transformations/zx/ChangeColor";
import { canDoPullOutSameColoredLeg } from "@/transformations/zx/PullOutSameColoredLeg";
import { canDoBialgebra } from "@/transformations/zx/Bialgebra";
import { canDoInverseBialgebra } from "@/transformations/zx/InverseBialgebra";
import { canDoHopfRule } from "@/transformations/zx/Hopf";
import { canUnfuseInto2Legos } from "@/transformations/zx/UnfuseIntoTwoLegos";
import { canUnfuseToLegs } from "@/transformations/zx/UnfuseToLegs";
import { canDoCompleteGraphViaHadamards } from "@/transformations/graph-states/CompleteGraphViaHadamards";
import { canDoConnectGraphNodes } from "@/transformations/graph-states/ConnectGraphNodesWithCenterLego";
import { usePanelConfigStore } from "@/stores/panelConfigStore";
import { useColorMode } from "@chakra-ui/react";
import { useEffect } from "react";

interface SubnetToolbarProps {
  boundingBox?: BoundingBox;
  onRemoveHighlights?: () => void;
  isUserLoggedIn?: boolean;
  responsive?: boolean;
  className?: string;
}

interface BoundingBoxWithConstrainedToolbar extends BoundingBox {
  constrainedToolbarTop: number;
  constrainedToolbarLeft: number;
  constrainedNameTop: number;
  constrainedNameLeft: number;
}

const ToolbarButton: React.FC<{
  icon?: React.ReactNode;
  text?: string;
  tooltip: string;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ icon, text, tooltip, onClick, disabled = false }) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <button
        className={`toolbar-button ${disabled ? "disabled" : ""}`}
        onClick={onClick}
        disabled={disabled}
      >
        {icon || text}
      </button>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        className="tooltip-content"
        side="bottom"
        sideOffset={5}
        style={{
          zIndex: 100000
        }}
      >
        {tooltip}
        <Tooltip.Arrow className="tooltip-arrow" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

const ToolbarSeparator: React.FC = () => <div className="toolbar-separator" />;

const GroupTab: React.FC<{
  label: string;
  color: string;
  isVisible: boolean;
}> = ({ label, color, isVisible }) => (
  <div
    className={`group-tab ${isVisible ? "visible" : ""}`}
    style={{
      backgroundColor: color
    }}
  >
    {label}
  </div>
);

export const SubnetToolbar: React.FC<SubnetToolbarProps> = ({
  boundingBox,
  onRemoveHighlights,
  isUserLoggedIn,
  responsive = false,
  className = ""
}) => {
  const { colorMode } = useColorMode();

  // Set CSS custom properties based on Chakra UI color mode
  useEffect(() => {
    const root = document.documentElement;
    if (colorMode === "dark") {
      root.setAttribute("data-theme", "dark");
    } else {
      root.removeAttribute("data-theme");
    }
  }, [colorMode]);

  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const connections = useCanvasStore((state) => state.connections);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const handleChangeColor = useCanvasStore((state) => state.handleChangeColor);
  const unCacheTensorNetwork = useCanvasStore(
    (state) => state.unCacheTensorNetwork
  );
  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );
  const handlePullOutSameColoredLeg = useCanvasStore(
    (state) => state.handlePullOutSameColoredLeg
  );
  const handleBialgebra = useCanvasStore((state) => state.handleBialgebra);
  const handleInverseBialgebra = useCanvasStore(
    (state) => state.handleInverseBialgebra
  );
  const handleHopfRule = useCanvasStore((state) => state.handleHopfRule);

  const fuseLegos = useCanvasStore((state) => state.fuseLegos);
  const handleUnfuseInto2Legos = useCanvasStore(
    (state) => state.handleUnfuseInto2Legos
  );
  const handleUnfuseToLegs = useCanvasStore(
    (state) => state.handleUnfuseToLegs
  );

  const handleCompleteGraphViaHadamards = useCanvasStore(
    (state) => state.handleCompleteGraphViaHadamards
  );
  const handleConnectGraphNodes = useCanvasStore(
    (state) => state.handleConnectGraphNodes
  );
  const openWeightEnumeratorDialog = useCanvasStore(
    (state) => state.openWeightEnumeratorDialog
  );
  const calculateParityCheckMatrix = useCanvasStore(
    (state) => state.calculateParityCheckMatrix
  );
  const openPCMPanel = usePanelConfigStore((state) => state.openPCMPanel);
  const openSingleLegoPCMPanel = usePanelConfigStore(
    (state) => state.openSingleLegoPCMPanel
  );
  const isDisabled = !tensorNetwork;

  const handleParityCheckMatrix = async () => {
    if (tensorNetwork?.isSingleLego) {
      // For single legos, open the PCM panel directly with the lego's matrix
      const singleLego = tensorNetwork.singleLego;
      if (!responsive) {
        openSingleLegoPCMPanel(
          singleLego.instance_id,
          singleLego.short_name || singleLego.name
        );
      }
    } else {
      // For multi-lego networks, calculate the parity check matrix and open the panel
      await calculateParityCheckMatrix((networkSignature, networkName) => {
        if (!responsive) {
          // Open PCM panel after successful calculation
          openPCMPanel(networkSignature, networkName);
        }
      });
    }
  };

  const toolbarContent = (
    <>
      {/* Group Settings */}
      <div
        className="toolbar-group-container"
        data-group="subnet"
        onMouseEnter={() => setHoveredGroup("subnet")}
        onMouseLeave={() => setHoveredGroup(null)}
      >
        <GroupTab
          label="Subnet controls"
          color="#3b82f6"
          isVisible={hoveredGroup === "subnet"}
        />
        <div className="toolbar-group">
          <ToolbarButton
            icon={<FaMinimize size={16} />}
            tooltip="Collapse into a single lego"
            onClick={() => fuseLegos(tensorNetwork?.legos || [])}
            disabled={isDisabled || tensorNetwork?.legos.length === 1}
          />
          <ToolbarButton
            icon={<Trash2 size={16} />}
            tooltip="Remove this subnet from cache"
            onClick={() => unCacheTensorNetwork(tensorNetwork?.signature || "")}
            disabled={
              isDisabled ||
              !tensorNetwork ||
              tensorNetwork.legos.length === 1 ||
              !cachedTensorNetworks[tensorNetwork.signature]
            }
          />
          <ToolbarButton
            disabled={isDisabled}
            icon={<FaDropletSlash size={16} />}
            tooltip="Remove all highlights in subnet"
            onClick={onRemoveHighlights}
          />
        </div>
      </div>

      <ToolbarSeparator />

      {/* Calculations */}
      <div
        className="toolbar-group-container"
        data-group="calculations"
        onMouseEnter={() => setHoveredGroup("calculations")}
        onMouseLeave={() => setHoveredGroup(null)}
      >
        <GroupTab
          label="Calculations"
          color="#10b981"
          isVisible={hoveredGroup === "calculations"}
        />
        <div className="toolbar-group">
          <ToolbarButton
            icon={<BarChart3 size={16} />}
            tooltip={
              isUserLoggedIn
                ? "Calculate weight enumerator polynomial"
                : "Calculate weight enumerator polynomial - needs login"
            }
            onClick={() => {
              if (tensorNetwork) {
                openWeightEnumeratorDialog(tensorNetwork, connections);
              }
            }}
            disabled={!isUserLoggedIn || isDisabled}
          />
          <ToolbarButton
            icon={<Table size={16} />}
            tooltip="Calculate/show parity check matrix"
            onClick={handleParityCheckMatrix}
            disabled={isDisabled}
          />
        </div>
      </div>

      <ToolbarSeparator />

      {/* ZX Transformations */}
      <div
        className="toolbar-group-container"
        data-group="zx"
        onMouseEnter={() => setHoveredGroup("zx")}
        onMouseLeave={() => setHoveredGroup(null)}
      >
        <GroupTab
          label="ZX tools"
          color="#f59e0b"
          isVisible={hoveredGroup === "zx"}
        />
        <div className="toolbar-group">
          <ToolbarButton
            icon={<FaYinYang size={16} />}
            tooltip="Change color"
            onClick={() => {
              if (tensorNetwork?.legos[0]) {
                handleChangeColor(tensorNetwork.legos[0]);
              }
            }}
            disabled={!canDoChangeColor(tensorNetwork?.legos || [])}
          />
          <ToolbarButton
            text="+Leg"
            tooltip="Pull out lego of same color"
            disabled={!canDoPullOutSameColoredLeg(tensorNetwork?.legos || [])}
            onClick={() => {
              if (tensorNetwork?.legos[0]) {
                handlePullOutSameColoredLeg(tensorNetwork.legos[0]);
              }
            }}
          />
          <ToolbarButton
            text="Bi"
            tooltip="Bi-algebra transformation"
            disabled={
              !canDoBialgebra(
                tensorNetwork?.legos || [],
                tensorNetwork?.connections || []
              )
            }
            onClick={() => {
              if (tensorNetwork?.legos) {
                handleBialgebra(tensorNetwork.legos);
              }
            }}
          />
          <ToolbarButton
            tooltip="Inverse bi-algebra transformation"
            disabled={
              !canDoInverseBialgebra(
                tensorNetwork?.legos || [],
                tensorNetwork?.connections || []
              )
            }
            onClick={() => handleInverseBialgebra(tensorNetwork?.legos || [])}
            text="IBi"
          />
          <ToolbarButton
            tooltip="Hopf rule"
            disabled={
              !canDoHopfRule(
                tensorNetwork?.legos || [],
                tensorNetwork?.connections || []
              )
            }
            onClick={() => handleHopfRule(tensorNetwork?.legos || [])}
            text="Hopf"
          />
          <ToolbarButton
            icon={<Scissors size={16} />}
            tooltip="Unfuse to legs"
            onClick={() => {
              if (tensorNetwork?.legos[0]) {
                handleUnfuseToLegs(tensorNetwork.legos[0]);
              }
            }}
            disabled={!canUnfuseToLegs(tensorNetwork?.legos || [])}
          />
          <ToolbarButton
            icon={<Split size={16} />}
            tooltip="Unfuse into 2 legos"
            onClick={() => {
              if (tensorNetwork?.legos[0]) {
                handleUnfuseInto2Legos(tensorNetwork.legos[0]);
              }
            }}
            disabled={!canUnfuseInto2Legos(tensorNetwork?.legos || [])}
          />
        </div>
      </div>

      <ToolbarSeparator />

      {/* Graph State Transformations */}
      <div
        className="toolbar-group-container"
        data-group="graph"
        onMouseEnter={() => setHoveredGroup("graph")}
        onMouseLeave={() => setHoveredGroup(null)}
      >
        <GroupTab
          label="Graph state tools"
          color="#8b5cf6"
          isVisible={hoveredGroup === "graph"}
        />
        <div className="toolbar-group">
          <ToolbarButton
            icon={<Network size={16} />}
            tooltip="Complete graph through Hadamard"
            onClick={() =>
              handleCompleteGraphViaHadamards(tensorNetwork?.legos || [])
            }
            disabled={
              !canDoCompleteGraphViaHadamards(tensorNetwork?.legos || [])
            }
          />
          <ToolbarButton
            icon={<Link size={16} />}
            tooltip="Connect via central lego"
            onClick={() => handleConnectGraphNodes(tensorNetwork?.legos || [])}
            disabled={!canDoConnectGraphNodes(tensorNetwork?.legos || [])}
          />
        </div>
      </div>
    </>
  );

  // If responsive mode, return just the content without positioning
  if (responsive) {
    return (
      <Tooltip.Provider>
        <div className={`subnet-toolbar responsive ${className}`}>
          {toolbarContent}
        </div>
      </Tooltip.Provider>
    );
  }

  // Original overlay positioning logic
  if (!boundingBox) {
    return null;
  }

  return (
    <Tooltip.Provider>
      <div
        className="subnet-toolbar"
        style={{
          position: "absolute",
          top:
            (boundingBox as BoundingBoxWithConstrainedToolbar)
              .constrainedToolbarTop || boundingBox.minY - 90,
          left:
            (boundingBox as BoundingBoxWithConstrainedToolbar)
              .constrainedToolbarLeft ||
            boundingBox.minX + boundingBox.width / 2,
          zIndex: 1000,
          transform: (boundingBox as BoundingBoxWithConstrainedToolbar)
            .constrainedToolbarTop
            ? "none"
            : "translateY(-100%) translateX(-50%)", // Only center if not constrained
          pointerEvents: "auto"
        }}
      >
        {toolbarContent}
      </div>
    </Tooltip.Provider>
  );
};
