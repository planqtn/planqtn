import { create } from "zustand";

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

  // Other modals can be added here later
  dynamicLegoDialog: boolean;
  runtimeConfigDialog: boolean;
  weightEnumeratorDialog: boolean;
  pythonCodeModal: boolean;
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

interface ModalStore extends ModalState {
  // Loading state
  loadingState: LoadingState;

  // Custom lego state
  customLegoState: CustomLegoState;

  // Auth state
  authState: AuthState;

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

  // Generic actions for future modals
  openModal: (modalName: keyof ModalState) => void;
  closeModal: (modalName: keyof ModalState) => void;
  closeAllModals: () => void;
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
  weightEnumeratorDialog: false,
  pythonCodeModal: false
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

export const useModalStore = create<ModalStore>((set) => ({
  ...initialState,
  loadingState: initialLoadingState,
  customLegoState: initialCustomLegoState,
  authState: initialAuthState,

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
      authState: initialAuthState
    })
}));
