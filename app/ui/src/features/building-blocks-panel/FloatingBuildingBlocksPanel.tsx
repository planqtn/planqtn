import React from "react";
import BuildingBlocksPanel from "./BuildingBlocksPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

interface FloatingBuildingBlocksPanelProps {
  isUserLoggedIn?: boolean;
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
}

const FloatingBuildingBlocksPanel: React.FC<
  FloatingBuildingBlocksPanelProps
> = ({ isUserLoggedIn, config, onConfigChange, onClose }) => {
  return (
    <FloatingPanelWrapper
      config={config}
      onConfigChange={onConfigChange}
      onClose={onClose}
    >
      <BuildingBlocksPanel isUserLoggedIn={isUserLoggedIn} />
    </FloatingPanelWrapper>
  );
};

export default FloatingBuildingBlocksPanel;
