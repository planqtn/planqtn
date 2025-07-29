import React from "react";
import DetailsPanel from "./DetailsPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

interface FloatingDetailsPanelProps {
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
}

const FloatingDetailsPanel: React.FC<FloatingDetailsPanelProps> = ({
  config,
  onConfigChange,
  onClose
}) => {
  return (
    <FloatingPanelWrapper
      title="Details"
      config={config}
      onConfigChange={onConfigChange}
      onClose={onClose}
    >
      <DetailsPanel />
    </FloatingPanelWrapper>
  );
};

export default FloatingDetailsPanel;
