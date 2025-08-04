import { StateCreator } from "zustand";
import { TensorNetwork } from "../lib/TensorNetwork";
import { Connection } from "./connectionStore";
import { RuntimeConfigService } from "@/features/kernel/runtimeConfigService";
import { CanvasStore } from "./canvasStateStore";

export interface ModalState {
  // Network dialogs
  cssTannerDialog: boolean;
  tannerDialog: boolean;
  mspDialog: boolean;

  // Loading modal
  loadingModal: boolean;

  // Custom lego dialog
  customLegoDialog: boolean;

  // Auth dialog
  authDialog: boolean;

  // Runtime config dialog
  runtimeConfigDialog: boolean;

  // Share dialog
  shareDialog: boolean;

  // Import canvas dialog
  importCanvasDialog: boolean;

  // Help dialog
  helpDialog: boolean;

  // Other modals can be added here later
  dynamicLegoDialog: boolean;
  weightEnumeratorDialog: boolean;
  pythonCodeModal: boolean;
  aboutDialog: boolean;
  showLegPartitionDialog: boolean;
  quotasDialog: boolean;
}

export interface HelpState {
  helpUrl?: string;
  title?: string;
}

export interface LoadingState {
  message: string;
}

export interface CustomLegoState {
  position: { x: number; y: number };
}

export interface AuthState {
  connectionError?: string;
}

export interface RuntimeConfigState {
  isLocal: boolean;
  initialConfig?: Record<string, string>;
}

export interface WeightEnumeratorState {
  subNetwork: TensorNetwork | null;
  mainNetworkConnections: Connection[];
}

export interface ModalSlice extends ModalState {
  // Loading state
  loadingState: LoadingState;

  // Custom lego state
  customLegoState: CustomLegoState;

  // Auth state
  authState: AuthState;

  // Runtime config state
  runtimeConfigState: RuntimeConfigState;

  // Weight enumerator state
  weightEnumeratorState: WeightEnumeratorState;

  // Help state
  helpState: HelpState;

  // Network dialog actions
  openCssTannerDialog: () => void;
  closeCssTannerDialog: () => void;
  openTannerDialog: () => void;
  closeTannerDialog: () => void;
  openMspDialog: () => void;
  closeMspDialog: () => void;

  // Loading modal actions
  openLoadingModal: (message: string) => void;
  closeLoadingModal: () => void;

  // Custom lego dialog actions
  openCustomLegoDialog: (position: { x: number; y: number }) => void;
  closeCustomLegoDialog: () => void;

  // Auth dialog actions
  openAuthDialog: (connectionError?: string) => void;
  closeAuthDialog: () => void;

  // Runtime config dialog actions
  openRuntimeConfigDialog: (
    isLocal: boolean,
    initialConfig?: Record<string, string>
  ) => void;
  closeRuntimeConfigDialog: () => void;

  // Share dialog actions
  openShareDialog: () => void;
  closeShareDialog: () => void;

  // Import canvas dialog actions
  openImportCanvasDialog: () => void;
  closeImportCanvasDialog: () => void;

  // Help dialog actions
  openHelpDialog: (helpUrl?: string, title?: string) => void;
  closeHelpDialog: () => void;

  // About dialog actions
  openAboutDialog: () => void;
  closeAboutDialog: () => void;

  // Weight enumerator dialog actions
  openWeightEnumeratorDialog: (
    subNetwork: TensorNetwork,
    mainNetworkConnections: Connection[]
  ) => void;
  closeWeightEnumeratorDialog: () => void;

  // Leg partition dialog actions
  openLegPartitionDialog: () => void;
  closeLegPartitionDialog: () => void;

  // Generic actions for future modals
  openModal: (modalName: keyof ModalState) => void;
  closeModal: (modalName: keyof ModalState) => void;
  closeAllModals: () => void;

  // Runtime toggle actions
  handleRuntimeToggle: () => void;

  // Quotas dialog actions
  openQuotasDialog: () => void;
  closeQuotasDialog: () => void;
}

const initialState: ModalState = {
  cssTannerDialog: false,
  tannerDialog: false,
  mspDialog: false,
  loadingModal: false,
  customLegoDialog: false,
  dynamicLegoDialog: false,
  authDialog: false,
  runtimeConfigDialog: false,
  shareDialog: false,
  importCanvasDialog: false,
  helpDialog: false,
  weightEnumeratorDialog: false,
  pythonCodeModal: false,
  aboutDialog: false,
  showLegPartitionDialog: false,
  quotasDialog: false
};

const initialLoadingState: LoadingState = {
  message: ""
};

const initialCustomLegoState: CustomLegoState = {
  position: { x: 0, y: 0 }
};

const initialAuthState: AuthState = {
  connectionError: undefined
};

const initialRuntimeConfigState: RuntimeConfigState = {
  isLocal: false,
  initialConfig: undefined
};

const initialWeightEnumeratorState: WeightEnumeratorState = {
  subNetwork: null,
  mainNetworkConnections: []
};

const initialHelpState: HelpState = {
  helpUrl: "/docs/planqtn-studio/ui-controls/#canvases-panel",
  title: "Help"
};

export const createModalsSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  ModalSlice
> = (set) => ({
  ...initialState,
  loadingState: initialLoadingState,
  customLegoState: initialCustomLegoState,
  authState: initialAuthState,
  runtimeConfigState: initialRuntimeConfigState,
  weightEnumeratorState: initialWeightEnumeratorState,
  helpState: initialHelpState,

  // Network dialog actions
  openCssTannerDialog: () => set({ cssTannerDialog: true }),
  closeCssTannerDialog: () => set({ cssTannerDialog: false }),
  openTannerDialog: () => set({ tannerDialog: true }),
  closeTannerDialog: () => set({ tannerDialog: false }),
  openMspDialog: () => set({ mspDialog: true }),
  closeMspDialog: () => set({ mspDialog: false }),

  // Loading modal actions
  openLoadingModal: (message: string) =>
    set({
      loadingModal: true,
      loadingState: { message }
    }),
  closeLoadingModal: () =>
    set({
      loadingModal: false,
      loadingState: { message: "" }
    }),

  // Custom lego dialog actions
  openCustomLegoDialog: (position: { x: number; y: number }) =>
    set({
      customLegoDialog: true,
      customLegoState: { position }
    }),
  closeCustomLegoDialog: () =>
    set({
      customLegoDialog: false,
      customLegoState: { position: { x: 0, y: 0 } }
    }),

  // Auth dialog actions
  openAuthDialog: (connectionError?: string) =>
    set({
      authDialog: true,
      authState: { connectionError }
    }),
  closeAuthDialog: () =>
    set({
      authDialog: false,
      authState: { connectionError: undefined }
    }),

  // Runtime config dialog actions
  openRuntimeConfigDialog: (
    isLocal: boolean,
    initialConfig?: Record<string, string>
  ) =>
    set({
      runtimeConfigDialog: true,
      runtimeConfigState: { isLocal, initialConfig }
    }),
  closeRuntimeConfigDialog: () =>
    set({
      runtimeConfigDialog: false,
      runtimeConfigState: { isLocal: false, initialConfig: undefined }
    }),

  // Share dialog actions
  openShareDialog: () => set({ shareDialog: true }),
  closeShareDialog: () => set({ shareDialog: false }),

  // Import canvas dialog actions
  openImportCanvasDialog: () => set({ importCanvasDialog: true }),
  closeImportCanvasDialog: () => set({ importCanvasDialog: false }),

  // Help dialog actions
  openHelpDialog: (helpUrl?: string, title?: string) =>
    set({
      helpDialog: true,
      helpState: { helpUrl, title }
    }),
  closeHelpDialog: () =>
    set({
      helpDialog: false,
      helpState: initialHelpState
    }),

  // About dialog actions
  openAboutDialog: () => set({ aboutDialog: true }),
  closeAboutDialog: () => set({ aboutDialog: false }),

  // Weight enumerator dialog actions
  openWeightEnumeratorDialog: (
    subNetwork: TensorNetwork,
    mainNetworkConnections: Connection[]
  ) =>
    set({
      weightEnumeratorDialog: true,
      weightEnumeratorState: { subNetwork, mainNetworkConnections }
    }),
  closeWeightEnumeratorDialog: () =>
    set({
      weightEnumeratorDialog: false,
      weightEnumeratorState: { subNetwork: null, mainNetworkConnections: [] }
    }),

  openLegPartitionDialog: () => set({ showLegPartitionDialog: true }),
  closeLegPartitionDialog: () => set({ showLegPartitionDialog: false }),

  // Generic actions
  openModal: (modalName: keyof ModalState) =>
    set((state) => ({ ...state, [modalName]: true })),
  closeModal: (modalName: keyof ModalState) =>
    set((state) => ({ ...state, [modalName]: false })),

  closeAllModals: () =>
    set({
      ...initialState,
      loadingState: initialLoadingState,
      customLegoState: initialCustomLegoState,
      authState: initialAuthState,
      runtimeConfigState: initialRuntimeConfigState,
      weightEnumeratorState: initialWeightEnumeratorState
    }),

  handleRuntimeToggle: () => {
    const isLocalRuntime = RuntimeConfigService.isLocalRuntime();
    if (isLocalRuntime) {
      RuntimeConfigService.switchToCloud();
    } else {
      const currentConfig = RuntimeConfigService.getCurrentConfig();
      set({
        runtimeConfigDialog: true,
        runtimeConfigState: {
          isLocal: isLocalRuntime,
          initialConfig: currentConfig || undefined
        }
      });
    }
  },

  openQuotasDialog: () => set({ quotasDialog: true }),
  closeQuotasDialog: () => set({ quotasDialog: false })
});
