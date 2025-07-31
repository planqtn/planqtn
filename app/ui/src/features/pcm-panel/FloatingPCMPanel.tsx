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
  isSingleLego?: boolean;
  singleLegoInstanceId?: string;
}

const FloatingPCMPanel: React.FC<FloatingPCMPanelProps> = ({
  config,
  onConfigChange,
  onClose,
  networkSignature,
  parityCheckMatrix,
  networkName,
  isSingleLego = false,
  singleLegoInstanceId
}) => {
  return (
    <FloatingPanelWrapper
      title={config.title}
      config={config}
      onConfigChange={onConfigChange}
      onClose={onClose}
      showCollapseButton={true}
      showResizeHandle={true}
    >
      <PCMPanel
        networkSignature={networkSignature}
        parityCheckMatrix={parityCheckMatrix}
        networkName={networkName}
        isSingleLego={isSingleLego}
        singleLegoInstanceId={singleLegoInstanceId}
      />
    </FloatingPanelWrapper>
  );
};

export default FloatingPCMPanel;
