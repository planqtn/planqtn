import { StateCreator } from "zustand";
import { FloatingPanelConfigManager } from "../features/floating-panel/FloatingPanelConfig";

export interface PanelConfigSlice {
  // Static panel configurations
  buildingBlocksPanelConfig: FloatingPanelConfigManager;
  setBuildingBlocksPanelConfig: (config: FloatingPanelConfigManager) => void;
  detailsPanelConfig: FloatingPanelConfigManager;
  setDetailsPanelConfig: (config: FloatingPanelConfigManager) => void;
  canvasesPanelConfig: FloatingPanelConfigManager;
  setCanvasesPanelConfig: (config: FloatingPanelConfigManager) => void;
  taskPanelConfig: FloatingPanelConfigManager;
  setTaskPanelConfig: (config: FloatingPanelConfigManager) => void;
  subnetsPanelConfig: FloatingPanelConfigManager;
  setSubnetsPanelConfig: (config: FloatingPanelConfigManager) => void;
  pcmPanelConfig: FloatingPanelConfigManager;
  setPCMPanelConfig: (config: FloatingPanelConfigManager) => void;

  // PCM panel state
  openPCMPanels: Record<string, FloatingPanelConfigManager>;
  addPCMPanel: (
    networkSignature: string,
    config: FloatingPanelConfigManager
  ) => void;
  removePCMPanel: (networkSignature: string) => void;
  updatePCMPanel: (
    networkSignature: string,
    config: FloatingPanelConfigManager
  ) => void;
  openPCMPanel: (networkSignature: string, networkName: string) => void;

  // Z-index management for floating panels
  nextZIndex: number;
  bringPanelToFront: (panelId: string) => void;
}

export const createPanelConfigSlice: StateCreator<
  PanelConfigSlice,
  [["zustand/immer", never]],
  [],
  PanelConfigSlice
> = (set) => ({
  // Static panel configurations
  buildingBlocksPanelConfig: new FloatingPanelConfigManager({
    id: "building-blocks",
    title: "Building Blocks",
    isOpen: false,
    isCollapsed: false,
    layout: {
      position: { x: 50, y: 50 },
      size: { width: 300, height: 600 }
    },
    minWidth: 200,
    minHeight: 300,
    defaultWidth: 300,
    defaultHeight: 600,
    zIndex: 1000
  }),
  setBuildingBlocksPanelConfig: (config) =>
    set((state) => {
      state.buildingBlocksPanelConfig = config;
    }),
  detailsPanelConfig: new FloatingPanelConfigManager({
    id: "details",
    title: "Details",
    isOpen: false,
    isCollapsed: false,
    layout: {
      position: { x: window.innerWidth - 400, y: 50 },
      size: { width: 350, height: 600 }
    },
    minWidth: 200,
    minHeight: 300,
    defaultWidth: 350,
    defaultHeight: 600,
    zIndex: 1001
  }),
  setDetailsPanelConfig: (config) =>
    set((state) => {
      state.detailsPanelConfig = config;
    }),
  canvasesPanelConfig: new FloatingPanelConfigManager({
    id: "canvases",
    title: "Canvases",
    isOpen: false,
    isCollapsed: false,
    layout: {
      position: { x: 100, y: 100 },
      size: { width: 300, height: 500 }
    },
    minWidth: 250,
    minHeight: 300,
    defaultWidth: 300,
    defaultHeight: 500,
    zIndex: 1002
  }),
  setCanvasesPanelConfig: (config) =>
    set((state) => {
      state.canvasesPanelConfig = config;
    }),
  taskPanelConfig: new FloatingPanelConfigManager({
    id: "tasks",
    title: "Tasks",
    isOpen: false,
    isCollapsed: false,
    layout: {
      position: { x: 100, y: 100 },
      size: { width: 600, height: 400 }
    },
    minWidth: 300,
    minHeight: 200,
    defaultWidth: 600,
    defaultHeight: 400,
    zIndex: 1003
  }),
  setTaskPanelConfig: (config) =>
    set((state) => {
      state.taskPanelConfig = config;
    }),
  subnetsPanelConfig: new FloatingPanelConfigManager({
    id: "subnets",
    title: "Subnets",
    isOpen: false,
    isCollapsed: false,
    layout: {
      position: { x: 150, y: 150 },
      size: { width: 350, height: 500 }
    },
    minWidth: 250,
    minHeight: 300,
    defaultWidth: 350,
    defaultHeight: 500,
    zIndex: 1004
  }),
  setSubnetsPanelConfig: (config) =>
    set((state) => {
      state.subnetsPanelConfig = config;
    }),
  pcmPanelConfig: new FloatingPanelConfigManager({
    id: "pcm",
    title: "Parity Check Matrix",
    isOpen: false,
    isCollapsed: false,
    layout: {
      position: { x: 200, y: 200 },
      size: { width: 500, height: 600 }
    },
    minWidth: 300,
    minHeight: 400,
    defaultWidth: 500,
    defaultHeight: 600,
    zIndex: 1005
  }),
  setPCMPanelConfig: (config) =>
    set((state) => {
      state.pcmPanelConfig = config;
    }),
  openPCMPanels: {},
  addPCMPanel: (networkSignature: string, config: FloatingPanelConfigManager) =>
    set((state) => {
      state.openPCMPanels[networkSignature] = config;
      state.nextZIndex++;
    }),
  removePCMPanel: (networkSignature: string) =>
    set((state) => {
      delete state.openPCMPanels[networkSignature];
    }),
  updatePCMPanel: (
    networkSignature: string,
    config: FloatingPanelConfigManager
  ) =>
    set((state) => {
      state.openPCMPanels[networkSignature] = config;
    }),
  openPCMPanel: (networkSignature: string, networkName: string) =>
    set((state) => {
      // Check if PCM panel is already open for this network
      if (state.openPCMPanels[networkSignature]) {
        // Panel is already open, just bring it to front
        const nextZ = state.nextZIndex++;
        const newConfig = new FloatingPanelConfigManager({
          ...state.openPCMPanels[networkSignature].toJSON(),
          zIndex: nextZ
        });
        state.openPCMPanels[networkSignature] = newConfig;
        return;
      }

      // Create new PCM panel configuration
      const config = new FloatingPanelConfigManager({
        id: `pcm-${networkSignature}`,
        title: `PCM - ${networkName}`,
        isOpen: true,
        isCollapsed: false,
        layout: {
          position: {
            x: 200 + Math.random() * 100,
            y: 200 + Math.random() * 100
          },
          size: { width: 500, height: 600 }
        },
        minWidth: 300,
        minHeight: 400,
        defaultWidth: 500,
        defaultHeight: 600,
        zIndex: state.nextZIndex++
      });

      state.openPCMPanels[networkSignature] = config;
    }),

  // Z-index management for floating panels
  nextZIndex: 1100,
  bringPanelToFront: (panelId: string) => {
    set((state) => {
      const nextZ = state.nextZIndex++;

      // Check all panel types and update the matching one
      if (state.buildingBlocksPanelConfig.id === panelId) {
        const newConfig = new FloatingPanelConfigManager({
          ...state.buildingBlocksPanelConfig.toJSON(),
          zIndex: nextZ
        });
        state.buildingBlocksPanelConfig = newConfig;
      } else if (state.detailsPanelConfig.id === panelId) {
        const newConfig = new FloatingPanelConfigManager({
          ...state.detailsPanelConfig.toJSON(),
          zIndex: nextZ
        });
        state.detailsPanelConfig = newConfig;
      } else if (state.canvasesPanelConfig.id === panelId) {
        const newConfig = new FloatingPanelConfigManager({
          ...state.canvasesPanelConfig.toJSON(),
          zIndex: nextZ
        });
        state.canvasesPanelConfig = newConfig;
      } else if (state.taskPanelConfig.id === panelId) {
        const newConfig = new FloatingPanelConfigManager({
          ...state.taskPanelConfig.toJSON(),
          zIndex: nextZ
        });
        state.taskPanelConfig = newConfig;
      } else if (state.subnetsPanelConfig.id === panelId) {
        const newConfig = new FloatingPanelConfigManager({
          ...state.subnetsPanelConfig.toJSON(),
          zIndex: nextZ
        });
        state.subnetsPanelConfig = newConfig;
      } else if (state.pcmPanelConfig.id === panelId) {
        const newConfig = new FloatingPanelConfigManager({
          ...state.pcmPanelConfig.toJSON(),
          zIndex: nextZ
        });
        state.pcmPanelConfig = newConfig;
      } else if (state.openPCMPanels[panelId]) {
        // Handle PCM panels with dynamic IDs
        const newConfig = new FloatingPanelConfigManager({
          ...state.openPCMPanels[panelId].toJSON(),
          zIndex: nextZ
        });
        state.openPCMPanels[panelId] = newConfig;
      } else {
        // Check if it's a PCM panel with a different ID format (e.g., "pcm-networkSignature")
        const pcmKey = Object.keys(state.openPCMPanels).find(
          (key) => state.openPCMPanels[key].id === panelId
        );
        if (pcmKey) {
          const newConfig = new FloatingPanelConfigManager({
            ...state.openPCMPanels[pcmKey].toJSON(),
            zIndex: nextZ
          });
          state.openPCMPanels[pcmKey] = newConfig;
        }
      }
    });
  }
});
