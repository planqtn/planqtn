import React from "react";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";
import SingleWeightEnumDetailsPanel from "./SingleWeightEnumDetailsPanel";
import { useCanvasStore } from "../../stores/canvasStateStore";

interface FloatingWeightEnumeratorPanelProps {
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
  taskId: string;
  taskName: string;
}

const FloatingWeightEnumeratorPanel: React.FC<
  FloatingWeightEnumeratorPanelProps
> = ({ config, onConfigChange, onClose, taskId, taskName }) => {
  const weightEnumerators = useCanvasStore((state) => state.weightEnumerators);

  // Find the weight enumerator for this task
  let weightEnumerator = null;
  let tensorNetworkSignature = "";

  // Search through all weight enumerators to find the one with this taskId
  for (const [signature, enumerators] of Object.entries(weightEnumerators)) {
    const found = enumerators.find(
      (enumerator) => enumerator.taskId === taskId
    );
    if (found) {
      weightEnumerator = found;
      tensorNetworkSignature = signature;
      break;
    }
  }

  if (!weightEnumerator) {
    return null; // Weight enumerator not found, don't render panel
  }

  return (
    <FloatingPanelWrapper
      config={config}
      onConfigChange={onConfigChange}
      onClose={onClose}
      title={taskName}
    >
      <SingleWeightEnumDetailsPanel
        taskId={taskId}
        weightEnumerator={weightEnumerator}
        tensorNetworkSignature={tensorNetworkSignature}
      />
    </FloatingPanelWrapper>
  );
};

export default FloatingWeightEnumeratorPanel;
