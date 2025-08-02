import React, { useEffect } from "react";
import { usePanelConfigStore } from "../stores/panelConfigStore";
import { useCanvasStore } from "../stores/canvasStateStore";
import { FloatingPanelConfigManager } from "../features/floating-panel/FloatingPanelConfig";
import FloatingTaskPanel from "../features/tasks/FloatingTaskPanel";
import FloatingBuildingBlocksPanel from "../features/building-blocks-panel/FloatingBuildingBlocksPanel";
import FloatingDetailsPanel from "../features/details-panel/FloatingDetailsPanel";
import FloatingCanvasesPanel from "../features/canvases-panel/FloatingCanvasesPanel";
import FloatingSubnetsPanel from "../features/subnets-panel/FloatingSubnetsPanel";
import FloatingPCMPanel from "../features/pcm-panel/FloatingPCMPanel";

// Individual panel components that only subscribe to their own configs
const TaskPanelWrapper: React.FC = () => {
  const taskPanelConfig = usePanelConfigStore((state) => state.taskPanelConfig);
  const setTaskPanelConfig = usePanelConfigStore(
    (state) => state.setTaskPanelConfig
  );

  return (
    <FloatingTaskPanel
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

const BuildingBlocksPanelWrapper: React.FC = () => {
  const buildingBlocksPanelConfig = usePanelConfigStore(
    (state) => state.buildingBlocksPanelConfig
  );
  const setBuildingBlocksPanelConfig = usePanelConfigStore(
    (state) => state.setBuildingBlocksPanelConfig
  );

  return (
    <FloatingBuildingBlocksPanel
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

const DetailsPanelWrapper: React.FC = () => {
  const detailsPanelConfig = usePanelConfigStore(
    (state) => state.detailsPanelConfig
  );
  const setDetailsPanelConfig = usePanelConfigStore(
    (state) => state.setDetailsPanelConfig
  );

  return (
    <FloatingDetailsPanel
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

const SingleLegoPCMPanelsWrapper: React.FC = () => {
  const openSingleLegoPCMPanels = usePanelConfigStore(
    (state) => state.openSingleLegoPCMPanels
  );

  return (
    <>
      {Object.entries(openSingleLegoPCMPanels).map(
        ([legoInstanceId, config]) => (
          <SingleLegoPCMPanelWrapper
            key={legoInstanceId}
            legoInstanceId={legoInstanceId}
            config={config}
          />
        )
      )}
    </>
  );
};

const PCMPanelWrapper: React.FC<{
  networkSignature: string;
  config: FloatingPanelConfigManager;
}> = ({ networkSignature, config }) => {
  const updatePCMPanel = usePanelConfigStore((state) => state.updatePCMPanel);
  const removePCMPanel = usePanelConfigStore((state) => state.removePCMPanel);
  const parityCheckMatrices = useCanvasStore(
    (state) => state.parityCheckMatrices
  );
  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );
  return (
    <FloatingPCMPanel
      config={config}
      onConfigChange={(newConfig) =>
        updatePCMPanel(networkSignature, newConfig)
      }
      onClose={() => removePCMPanel(networkSignature)}
      networkSignature={networkSignature}
      parityCheckMatrix={parityCheckMatrices[networkSignature]!}
      networkName={
        cachedTensorNetworks[networkSignature]?.name || "Unknown Network"
      }
    />
  );
};

const SingleLegoPCMPanelWrapper: React.FC<{
  legoInstanceId: string;
  config: FloatingPanelConfigManager;
}> = ({ legoInstanceId, config }) => {
  const updateSingleLegoPCMPanel = usePanelConfigStore(
    (state) => state.updateSingleLegoPCMPanel
  );
  const removeSingleLegoPCMPanel = usePanelConfigStore(
    (state) => state.removeSingleLegoPCMPanel
  );
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);

  // Find the lego instance
  const lego = droppedLegos.find((l) => l.instance_id === legoInstanceId);
  if (!lego) {
    return null; // Lego not found, don't render panel
  }

  // Create parity check matrix from the lego's matrix
  const parityCheckMatrix = {
    matrix: lego.parity_check_matrix,
    legOrdering: Array.from({ length: lego.numberOfLegs }, (_, i) => ({
      instance_id: lego.instance_id,
      leg_index: i
    }))
  };

  return (
    <FloatingPCMPanel
      config={config}
      onConfigChange={(newConfig) =>
        updateSingleLegoPCMPanel(legoInstanceId, newConfig)
      }
      onClose={() => removeSingleLegoPCMPanel(legoInstanceId)}
      networkSignature={`single-lego-${legoInstanceId}`}
      parityCheckMatrix={parityCheckMatrix}
      networkName={lego.short_name || lego.name}
      isSingleLego={true}
      singleLegoInstanceId={legoInstanceId}
    />
  );
};

const FloatingPanelHandler: React.FC = () => {
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );
  const openPCMPanels = usePanelConfigStore((state) => state.openPCMPanels);
  const openSingleLegoPCMPanels = usePanelConfigStore(
    (state) => state.openSingleLegoPCMPanels
  );
  const removePCMPanel = usePanelConfigStore((state) => state.removePCMPanel);
  const removeSingleLegoPCMPanel = usePanelConfigStore(
    (state) => state.removeSingleLegoPCMPanel
  );

  // Clean up PCM panels when tensor networks are removed
  useEffect(() => {
    const availableNetworkSignatures = Object.keys(cachedTensorNetworks);

    // Close PCM panels for networks that no longer exist
    Object.keys(openPCMPanels).forEach((networkSignature) => {
      if (!availableNetworkSignatures.includes(networkSignature)) {
        removePCMPanel(networkSignature);
      }
    });
  }, [cachedTensorNetworks, openPCMPanels, removePCMPanel]);

  // Clean up single lego PCM panels when legos are removed
  useEffect(() => {
    const availableLegoInstanceIds = droppedLegos.map(
      (lego) => lego.instance_id
    );

    // Close PCM panels for legos that no longer exist
    Object.keys(openSingleLegoPCMPanels).forEach((legoInstanceId) => {
      if (!availableLegoInstanceIds.includes(legoInstanceId)) {
        removeSingleLegoPCMPanel(legoInstanceId);
      }
    });
  }, [droppedLegos, openSingleLegoPCMPanels, removeSingleLegoPCMPanel]);

  return (
    <>
      <TaskPanelWrapper />
      <BuildingBlocksPanelWrapper />
      <DetailsPanelWrapper />
      <CanvasesPanelWrapper />
      <SubnetsPanelWrapper />
      <PCMPanelsWrapper />
      <SingleLegoPCMPanelsWrapper />
    </>
  );
};

export default FloatingPanelHandler;
