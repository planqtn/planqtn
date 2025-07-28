import React from "react";
import SubnetsPanel from "./SubnetsPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

interface FloatingSubnetsPanelProps {
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
}

const FloatingSubnetsPanel: React.FC<FloatingSubnetsPanelProps> = ({
  config,
  onConfigChange,
  onClose
}) => {
  return (
    <FloatingPanelWrapper
      config={config}
      onConfigChange={onConfigChange}
      onClose={onClose}
      showCollapseButton={true}
      showResizeHandle={true}
      zIndex={1000}
    >
      <SubnetsPanel />
    </FloatingPanelWrapper>
  );
};

export default FloatingSubnetsPanel;
