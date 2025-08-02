import React from "react";
import TaskPanel from "./TaskPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";
import { FaBarsProgress } from "react-icons/fa6";

interface FloatingTaskPanelProps {
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
}

const FloatingTaskPanel: React.FC<FloatingTaskPanelProps> = ({
  config,
  onConfigChange,
  onClose
}) => {
  return (
    <FloatingPanelWrapper
      title="Tasks"
      config={config}
      onConfigChange={onConfigChange}
      onClose={onClose}
      icon={FaBarsProgress}
    >
      <TaskPanel floatingMode />
    </FloatingPanelWrapper>
  );
};

export default FloatingTaskPanel;
