import React from "react";
import { UseToastOptions } from "@chakra-ui/react";
import DetailsPanel from "./DetailsPanel";
import FloatingPanelWrapper from "../floating-panel/FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { User } from "@supabase/supabase-js";

interface FloatingDetailsPanelProps {
  fuseLegos: (legos: DroppedLego[]) => void;
  makeSpace: (
    center: { x: number; y: number },
    radius: number,
    skipLegos: DroppedLego[],
    legosToCheck: DroppedLego[]
  ) => DroppedLego[];
  handlePullOutSameColoredLeg: (lego: DroppedLego) => Promise<void>;
  toast: (props: UseToastOptions) => void;
  user?: User | null;
  config: FloatingPanelConfigManager;
  onConfigChange: (config: FloatingPanelConfigManager) => void;
  onClose: () => void;
}

const FloatingDetailsPanel: React.FC<FloatingDetailsPanelProps> = ({
  fuseLegos,
  makeSpace,
  handlePullOutSameColoredLeg,
  toast,
  user,
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
      <DetailsPanel
        fuseLegos={fuseLegos}
        makeSpace={makeSpace}
        handlePullOutSameColoredLeg={handlePullOutSameColoredLeg}
        toast={toast}
        user={user}
      />
    </FloatingPanelWrapper>
  );
};

export default FloatingDetailsPanel;
