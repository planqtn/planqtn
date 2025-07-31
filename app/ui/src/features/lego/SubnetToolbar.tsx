import React, { useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Lock,
  Unlock,
  Minus,
  Plus,
  BarChart3,
  Table,
  Split,
  Scissors,
  Network,
  Link,
  Trash2
} from "lucide-react";
import { FaDropletSlash, FaYinYang } from "react-icons/fa6";
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

interface SubnetToolbarProps {
  boundingBox: BoundingBox;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onCollapse?: () => void;
  onExpand?: () => void;
  onWeightEnumerator?: () => void;
  onParityCheckMatrix?: () => void;
  onCompleteGraph?: () => void;
  onConnectViaCentral?: () => void;
  onRemoveFromCache?: () => void;
  onRemoveHighlights?: () => void;
  isUserLoggedIn?: boolean;
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
      <Tooltip.Content className="tooltip-content" side="bottom" sideOffset={5}>
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
  isLocked = false,
  onToggleLock,
  onCollapse,
  onExpand,
  onWeightEnumerator,
  onParityCheckMatrix,
  onCompleteGraph,
  onConnectViaCentral,
  onRemoveFromCache,
  onRemoveHighlights,
  isUserLoggedIn
}) => {
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const handleChangeColor = useCanvasStore((state) => state.handleChangeColor);
  const handlePullOutSameColoredLeg = useCanvasStore(
    (state) => state.handlePullOutSameColoredLeg
  );

  const handleBialgebra = useCanvasStore((state) => state.handleBialgebra);
  const handleInverseBialgebra = useCanvasStore(
    (state) => state.handleInverseBialgebra
  );
  const handleHopfRule = useCanvasStore((state) => state.handleHopfRule);

  const hasMultipleLegos = tensorNetwork && tensorNetwork.legos.length > 1;
  const canCollapse = hasMultipleLegos;
  const handleUnfuseInto2Legos = useCanvasStore(
    (state) => state.handleUnfuseInto2Legos
  );
  const handleUnfuseToLegs = useCanvasStore(
    (state) => state.handleUnfuseToLegs
  );

  return (
    <Tooltip.Provider>
      <div
        className="subnet-toolbar"
        style={{
          position: "absolute",
          top:
            (boundingBox as any).constrainedToolbarTop || boundingBox.minY - 90,
          left:
            (boundingBox as any).constrainedToolbarLeft ||
            boundingBox.minX + boundingBox.width / 2,
          zIndex: 10000,
          transform: (boundingBox as any).constrainedToolbarTop
            ? "none"
            : "translateY(-100%) translateX(-50%)", // Only center if not constrained
          pointerEvents: "auto"
        }}
      >
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
              icon={isLocked ? <Lock size={16} /> : <Unlock size={16} />}
              tooltip={
                isLocked
                  ? "Unlock group for modifications"
                  : "Lock group for modifications"
              }
              onClick={onToggleLock}
            />
            <ToolbarButton
              icon={<Minus size={16} />}
              tooltip="Collapse into a single lego"
              onClick={onCollapse}
              disabled={!canCollapse}
            />
            <ToolbarButton
              icon={<Plus size={16} />}
              tooltip="Expand single lego (not implemented yet)"
              onClick={onExpand}
              disabled={true}
            />
            <ToolbarButton
              icon={<Trash2 size={16} />}
              tooltip="Remove this subnet from cache"
              onClick={onRemoveFromCache}
            />
            <ToolbarButton
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
              onClick={onWeightEnumerator}
              disabled={!isUserLoggedIn}
            />
            <ToolbarButton
              icon={<Table size={16} />}
              tooltip="Calculate/show parity check matrix"
              onClick={onParityCheckMatrix}
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
              onClick={() => handleChangeColor(tensorNetwork?.legos[0]!)}
              disabled={!canDoChangeColor(tensorNetwork?.legos || [])}
            />
            <ToolbarButton
              text="+Leg"
              tooltip="Pull out lego of same color"
              disabled={!canDoPullOutSameColoredLeg(tensorNetwork?.legos || [])}
              onClick={() =>
                handlePullOutSameColoredLeg(tensorNetwork?.legos[0]!)
              }
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
              onClick={() => handleBialgebra(tensorNetwork?.legos || [])}
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
              onClick={() => handleUnfuseToLegs(tensorNetwork?.legos[0]!)}
              disabled={!canUnfuseToLegs(tensorNetwork?.legos || [])}
            />
            <ToolbarButton
              icon={<Split size={16} />}
              tooltip="Unfuse into 2 legos"
              onClick={() => handleUnfuseInto2Legos(tensorNetwork?.legos[0]!)}
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
              onClick={onCompleteGraph}
            />
            <ToolbarButton
              icon={<Link size={16} />}
              tooltip="Connect via central lego"
              onClick={onConnectViaCentral}
            />
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
};
