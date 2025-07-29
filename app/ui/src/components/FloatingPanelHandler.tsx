import React from "react";
import { usePanelConfigStore } from "../stores/panelConfigStore";
import { useCanvasStore } from "../stores/canvasStateStore";
import { FloatingPanelConfigManager } from "../features/floating-panel/FloatingPanelConfig";
import FloatingTaskPanel from "../features/tasks/FloatingTaskPanel";
import FloatingBuildingBlocksPanel from "../features/building-blocks-panel/FloatingBuildingBlocksPanel";
import FloatingDetailsPanel from "../features/details-panel/FloatingDetailsPanel";
import FloatingCanvasesPanel from "../features/canvases-panel/FloatingCanvasesPanel";
import FloatingSubnetsPanel from "../features/subnets-panel/FloatingSubnetsPanel";
import FloatingPCMPanel from "../features/pcm-panel/FloatingPCMPanel";
import { User } from "@supabase/supabase-js";

interface FloatingPanelHandlerProps {
  currentUser: User | null;
  fuseLegos: (legos: any[]) => void;
  makeSpace: (
    center: { x: number; y: number },
    radius: number,
    skipLegos: any[],
    legosToCheck: any[]
  ) => any[];
  handlePullOutSameColoredLeg: (lego: any) => Promise<void>;
  toast: (props: any) => void;
  setError: (error: string | null) => void;
}

// Individual panel components that only subscribe to their own configs
const TaskPanelWrapper: React.FC<{
  currentUser: User | null;
  setError: (error: string | null) => void;
}> = ({ currentUser, setError }) => {
  const taskPanelConfig = usePanelConfigStore((state) => state.taskPanelConfig);
  const setTaskPanelConfig = usePanelConfigStore(
    (state) => state.setTaskPanelConfig
  );

  return (
    <FloatingTaskPanel
      user={currentUser}
      onError={(error) => setError(error)}
      config={taskPanelConfig}
      onConfigChange={setTaskPanelConfig}
      onClose={() => {
        const newConfig = new FloatingPanelConfigManager(
          taskPanelConfig.toJSON()
        );
        newConfig.setIsOpen(false);
        setTaskPanelConfig(newConfig);
      }}
    />
  );
};

const BuildingBlocksPanelWrapper: React.FC<{ currentUser: User | null }> = ({
  currentUser
}) => {
  const buildingBlocksPanelConfig = usePanelConfigStore(
    (state) => state.buildingBlocksPanelConfig
  );
  const setBuildingBlocksPanelConfig = usePanelConfigStore(
    (state) => state.setBuildingBlocksPanelConfig
  );

  const isUserLoggedIn = React.useMemo(() => !!currentUser, [currentUser]);

  return (
    <FloatingBuildingBlocksPanel
      isUserLoggedIn={isUserLoggedIn}
      config={buildingBlocksPanelConfig}
      onConfigChange={setBuildingBlocksPanelConfig}
      onClose={() => {
        const newConfig = new FloatingPanelConfigManager(
          buildingBlocksPanelConfig.toJSON()
        );
        newConfig.setIsOpen(false);
        setBuildingBlocksPanelConfig(newConfig);
      }}
    />
  );
};

const DetailsPanelWrapper: React.FC<{
  currentUser: User | null;
  fuseLegos: (legos: any[]) => void;
  makeSpace: (
    center: { x: number; y: number },
    radius: number,
    skipLegos: any[],
    legosToCheck: any[]
  ) => any[];
  handlePullOutSameColoredLeg: (lego: any) => Promise<void>;
  toast: (props: any) => void;
}> = ({
  currentUser,
  fuseLegos,
  makeSpace,
  handlePullOutSameColoredLeg,
  toast
}) => {
  const detailsPanelConfig = usePanelConfigStore(
    (state) => state.detailsPanelConfig
  );
  const setDetailsPanelConfig = usePanelConfigStore(
    (state) => state.setDetailsPanelConfig
  );

  return (
    <FloatingDetailsPanel
      fuseLegos={fuseLegos}
      makeSpace={makeSpace}
      handlePullOutSameColoredLeg={handlePullOutSameColoredLeg}
      toast={toast}
      user={currentUser}
      config={detailsPanelConfig}
      onConfigChange={setDetailsPanelConfig}
      onClose={() => {
        const newConfig = new FloatingPanelConfigManager(
          detailsPanelConfig.toJSON()
        );
        newConfig.setIsOpen(false);
        setDetailsPanelConfig(newConfig);
      }}
    />
  );
};

const CanvasesPanelWrapper: React.FC = () => {
  const canvasesPanelConfig = usePanelConfigStore(
    (state) => state.canvasesPanelConfig
  );
  const setCanvasesPanelConfig = usePanelConfigStore(
    (state) => state.setCanvasesPanelConfig
  );

  return (
    <FloatingCanvasesPanel
      config={canvasesPanelConfig}
      onConfigChange={setCanvasesPanelConfig}
      onClose={() => {
        const newConfig = new FloatingPanelConfigManager(
          canvasesPanelConfig.toJSON()
        );
        newConfig.setIsOpen(false);
        setCanvasesPanelConfig(newConfig);
      }}
    />
  );
};

const SubnetsPanelWrapper: React.FC = () => {
  const subnetsPanelConfig = usePanelConfigStore(
    (state) => state.subnetsPanelConfig
  );
  const setSubnetsPanelConfig = usePanelConfigStore(
    (state) => state.setSubnetsPanelConfig
  );

  return (
    <FloatingSubnetsPanel
      config={subnetsPanelConfig}
      onConfigChange={setSubnetsPanelConfig}
      onClose={() => {
        const newConfig = new FloatingPanelConfigManager(
          subnetsPanelConfig.toJSON()
        );
        newConfig.setIsOpen(false);
        setSubnetsPanelConfig(newConfig);
      }}
    />
  );
};

const PCMPanelsWrapper: React.FC = () => {
  const openPCMPanels = usePanelConfigStore((state) => state.openPCMPanels);

  return (
    <>
      {Object.entries(openPCMPanels).map(([networkSignature, config]) => (
        <PCMPanelWrapper
          key={networkSignature}
          networkSignature={networkSignature}
          config={config}
        />
      ))}
    </>
  );
};

const PCMPanelWrapper: React.FC<{
  networkSignature: string;
  config: FloatingPanelConfigManager;
}> = ({ networkSignature, config }) => {
  const updatePCMPanel = usePanelConfigStore((state) => state.updatePCMPanel);
  const removePCMPanel = usePanelConfigStore((state) => state.removePCMPanel);

  return (
    <FloatingPCMPanel
      config={config}
      onConfigChange={(newConfig) =>
        updatePCMPanel(networkSignature, newConfig)
      }
      onClose={() => removePCMPanel(networkSignature)}
      networkSignature={networkSignature}
      parityCheckMatrix={
        useCanvasStore.getState().parityCheckMatrices[networkSignature]!
      }
      networkName={
        useCanvasStore.getState().cachedTensorNetworks[networkSignature]
          ?.name || "Unknown Network"
      }
    />
  );
};

const FloatingPanelHandler: React.FC<FloatingPanelHandlerProps> = ({
  currentUser,
  fuseLegos,
  makeSpace,
  handlePullOutSameColoredLeg,
  toast,
  setError
}) => {
  return (
    <>
      <TaskPanelWrapper currentUser={currentUser} setError={setError} />
      <BuildingBlocksPanelWrapper currentUser={currentUser} />
      <DetailsPanelWrapper
        currentUser={currentUser}
        fuseLegos={fuseLegos}
        makeSpace={makeSpace}
        handlePullOutSameColoredLeg={handlePullOutSameColoredLeg}
        toast={toast}
      />
      <CanvasesPanelWrapper />
      <SubnetsPanelWrapper />
      <PCMPanelsWrapper />
    </>
  );
};

export default FloatingPanelHandler;
