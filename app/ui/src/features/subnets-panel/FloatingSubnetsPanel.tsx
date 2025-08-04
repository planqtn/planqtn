import React from "react";
import SubnetsPanel from "./SubnetsPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";
import { FaFolderTree } from "react-icons/fa6";

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
      title="Cached subnets and calculations"
      onConfigChange={onConfigChange}
      onClose={onClose}
      showCollapseButton={true}
      showResizeHandle={true}
      icon={FaFolderTree}
      showHelpButton={true}
      helpUrl="/docs/planqtn-studio/ui-controls/#subnets-panel"
      helpTitle="Subnets Panel Help"
    >
      <SubnetsPanel />
    </FloatingPanelWrapper>
  );
};

export default FloatingSubnetsPanel;
