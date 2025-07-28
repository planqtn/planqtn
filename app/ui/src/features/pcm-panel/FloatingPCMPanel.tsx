import React from "react";
import PCMPanel from "./PCMPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";
import { ParityCheckMatrix } from "../../stores/tensorNetworkStore";

interface FloatingPCMPanelProps {
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
  networkSignature: string;
  parityCheckMatrix: ParityCheckMatrix;
  networkName: string;
}

const FloatingPCMPanel: React.FC<FloatingPCMPanelProps> = ({
  config,
  onConfigChange,
  onClose,
  networkSignature,
  parityCheckMatrix,
  networkName
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
      <PCMPanel
        networkSignature={networkSignature}
        parityCheckMatrix={parityCheckMatrix}
        networkName={networkName}
      />
    </FloatingPanelWrapper>
  );
};

export default FloatingPCMPanel;
