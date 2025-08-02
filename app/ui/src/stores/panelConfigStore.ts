/* eslint-disable @typescript-eslint/no-explicit-any */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { PanelConfigSlice, createPanelConfigSlice } from "./panelConfigSlice";
import { FloatingPanelConfigManager } from "@/features/floating-panel/FloatingPanelConfig";

// Separate store for panel configurations (application-level persistence)
export const usePanelConfigStore = create<PanelConfigSlice>()(
  persist(
    immer((...a) => createPanelConfigSlice(...a)),
    {
      name: "panel-configs", // Global name, not canvas-specific
      partialize: (state: PanelConfigSlice) => {
        return {
          buildingBlocksPanelConfig: state.buildingBlocksPanelConfig.toJSON(),
          detailsPanelConfig: state.detailsPanelConfig.toJSON(),
          canvasesPanelConfig: state.canvasesPanelConfig.toJSON(),
          taskPanelConfig: state.taskPanelConfig.toJSON(),
          subnetsPanelConfig: state.subnetsPanelConfig.toJSON(),
          openPCMPanels: Object.fromEntries(
            Object.entries(state.openPCMPanels).map(([key, config]) => [
              key,
              config.toJSON()
            ])
          ),
          openSingleLegoPCMPanels: Object.fromEntries(
            Object.entries(state.openSingleLegoPCMPanels).map(
              ([key, config]) => [key, config.toJSON()]
            )
          ),
          nextZIndex: state.nextZIndex
        };
      },
      onRehydrateStorage: () => (state: PanelConfigSlice | undefined) => {
        if (!state) return;

        // Recreate FloatingPanelConfigManager instances from JSON
        const panelConfigs = state as unknown as {
          buildingBlocksPanelConfig?: any;
          detailsPanelConfig?: any;
          canvasesPanelConfig?: any;
          taskPanelConfig?: any;
          subnetsPanelConfig?: any;
          pcmPanelConfig?: any;
          openPCMPanels?: Record<string, any>;
          openSingleLegoPCMPanels?: Record<string, any>;
        };

        if (panelConfigs.buildingBlocksPanelConfig) {
          state.buildingBlocksPanelConfig = FloatingPanelConfigManager.fromJSON(
            panelConfigs.buildingBlocksPanelConfig
          );
        }
        if (panelConfigs.detailsPanelConfig) {
          state.detailsPanelConfig = FloatingPanelConfigManager.fromJSON(
            panelConfigs.detailsPanelConfig
          );
        }
        if (panelConfigs.canvasesPanelConfig) {
          state.canvasesPanelConfig = FloatingPanelConfigManager.fromJSON(
            panelConfigs.canvasesPanelConfig
          );
        }
        if (panelConfigs.taskPanelConfig) {
          state.taskPanelConfig = FloatingPanelConfigManager.fromJSON(
            panelConfigs.taskPanelConfig
          );
        }
        if (panelConfigs.subnetsPanelConfig) {
          state.subnetsPanelConfig = FloatingPanelConfigManager.fromJSON(
            panelConfigs.subnetsPanelConfig
          );
        }

        if (panelConfigs.openPCMPanels) {
          state.openPCMPanels = Object.fromEntries(
            Object.entries(panelConfigs.openPCMPanels).map(([key, config]) => [
              key,
              FloatingPanelConfigManager.fromJSON(config)
            ])
          );
        }
        if (panelConfigs.openSingleLegoPCMPanels) {
          state.openSingleLegoPCMPanels = Object.fromEntries(
            Object.entries(panelConfigs.openSingleLegoPCMPanels).map(
              ([key, config]) => [
                key,
                FloatingPanelConfigManager.fromJSON(config)
              ]
            )
          );
        }

        // Ensure nextZIndex is higher than the highest panel z-index
        const panelZIndices = [
          state.buildingBlocksPanelConfig?.zIndex,
          state.detailsPanelConfig?.zIndex,
          state.canvasesPanelConfig?.zIndex,
          state.taskPanelConfig?.zIndex,
          state.subnetsPanelConfig?.zIndex,
          ...Object.values(state.openPCMPanels || {}).map(
            (config) => config.zIndex
          ),
          ...Object.values(state.openSingleLegoPCMPanels || {}).map(
            (config) => config.zIndex
          )
        ].filter((zIndex): zIndex is number => zIndex !== undefined);

        const maxPanelZIndex = Math.max(...panelZIndices, 1000);
        const currentNextZIndex = state.nextZIndex || 1100;

        if (currentNextZIndex <= maxPanelZIndex) {
          state.nextZIndex = maxPanelZIndex + 1;
        }
      }
    }
  )
);
