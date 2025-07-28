import React from "react";
import TaskPanel from "./TaskPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

interface FloatingTaskPanelProps {
  user?: { id: string } | null;
  onError: (error: string) => void;
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
}

const FloatingTaskPanel: React.FC<FloatingTaskPanelProps> = ({
  user,
  onError,
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
      <TaskPanel user={user} onError={onError} floatingMode />
    </FloatingPanelWrapper>
  );
};

export default FloatingTaskPanel;
