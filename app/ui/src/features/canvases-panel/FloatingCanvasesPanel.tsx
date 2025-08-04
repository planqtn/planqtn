import React from "react";
import CanvasesPanel from "./CanvasesPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";
import { FaLayerGroup } from "react-icons/fa6";

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
      title="Canvases"
      onConfigChange={onConfigChange}
      onClose={onClose}
      icon={FaLayerGroup}
      showHelpButton={true}
      helpUrl="/docs/planqtn-studio/ui-controls/#canvases-panel"
      helpTitle="Canvases Panel Help"
    >
      <CanvasesPanel />
    </FloatingPanelWrapper>
  );
};

export default FloatingCanvasesPanel;
