import React from "react";
import CanvasesPanel from "./CanvasesPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

interface FloatingCanvasesPanelProps {
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
}

const FloatingCanvasesPanel: React.FC<FloatingCanvasesPanelProps> = ({
  config,
  onConfigChange,
  onClose
}) => {
  return (
    <FloatingPanelWrapper
      config={config}
      onConfigChange={onConfigChange}
      onClose={onClose}
    >
      <CanvasesPanel />
    </FloatingPanelWrapper>
  );
};

export default FloatingCanvasesPanel;
