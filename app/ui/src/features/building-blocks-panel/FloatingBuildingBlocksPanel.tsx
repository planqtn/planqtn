import React from "react";
import BuildingBlocksPanel from "./BuildingBlocksPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";
import { FaCubes } from "react-icons/fa6";

interface FloatingBuildingBlocksPanelProps {
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
}

const FloatingBuildingBlocksPanel: React.FC<
  FloatingBuildingBlocksPanelProps
> = ({ config, onConfigChange, onClose }) => {
  return (
    <FloatingPanelWrapper
      title="Building blocks"
      config={config}
      onConfigChange={onConfigChange}
      onClose={onClose}
      icon={FaCubes}
      showHelpButton={true}
      helpUrl="/docs/planqtn-studio/ui-controls/#building-blocks-panel"
      helpTitle="Building Blocks Panel Help"
    >
      <BuildingBlocksPanel />
    </FloatingPanelWrapper>
  );
};

export default FloatingBuildingBlocksPanel;
