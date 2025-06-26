import React from "react";
import ReactDOM from "react-dom";
import { useModalStore } from "../stores/modalStore";
import { TannerDialog } from "./TannerDialog";
import LoadingModal from "./LoadingModal";
import AuthDialog from "./AuthDialog";
import { RuntimeConfigDialog } from "./RuntimeConfigDialog";
import { NetworkService, NetworkCreationOptions } from "../lib/networkService";
import {
  CustomLegoService,
  CustomLegoCreationOptions
} from "../lib/customLegoService";
import { RuntimeConfigService } from "../lib/runtimeConfigService";
import { OperationHistory } from "../lib/OperationHistory";
import { CanvasStateSerializer } from "../lib/CanvasStateSerializer";
import { useToast } from "@chakra-ui/react";

interface ModalRootProps {
  operationHistory: OperationHistory;
  stateSerializer: CanvasStateSerializer;
  hideConnectedLegs: boolean;
  newInstanceId: () => string;
}

export const ModalRoot: React.FC<ModalRootProps> = ({
  operationHistory,
  stateSerializer,
  hideConnectedLegs,
  newInstanceId
}) => {
  const {
    cssTannerDialog,
    tannerDialog,
    mspDialog,
    loadingModal,
    customLegoDialog,
    authDialog,
    runtimeConfigDialog,
    loadingState,
    customLegoState,
    authState,
    runtimeConfigState,
    closeCssTannerDialog,
    closeTannerDialog,
    closeMspDialog,
    closeCustomLegoDialog,
    closeAuthDialog,
    closeRuntimeConfigDialog
  } = useModalStore();

  const toast = useToast();

  const createNetworkOptions = (): NetworkCreationOptions => ({
    operationHistory,
    stateSerializer,
    hideConnectedLegs,
    newInstanceId
  });

  const handleCssTannerSubmit = async (matrix: number[][]) => {
    try {
      await NetworkService.createCssTannerNetwork(
        matrix,
        createNetworkOptions()
      );
      toast({
        title: "Success",
        description: "CSS Tanner network created successfully",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create network",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    }
  };

  const handleTannerSubmit = async (matrix: number[][]) => {
    try {
      await NetworkService.createTannerNetwork(matrix, createNetworkOptions());
      toast({
        title: "Success",
        description: "Tanner network created successfully",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create network",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    }
  };

  const handleMspSubmit = async (matrix: number[][]) => {
    try {
      await NetworkService.createMspNetwork(matrix, createNetworkOptions());
      toast({
        title: "Success",
        description: "MSP network created successfully",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create network",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    }
  };

  const createCustomLegoOptions = (): CustomLegoCreationOptions => ({
    operationHistory,
    stateSerializer,
    hideConnectedLegs,
    newInstanceId
  });

  const handleCustomLegoSubmit = async (
    matrix: number[][],
    logicalLegs: number[]
  ) => {
    try {
      CustomLegoService.createCustomLego(
        matrix,
        logicalLegs,
        customLegoState.position,
        createCustomLegoOptions()
      );
      toast({
        title: "Success",
        description: "Custom lego created successfully",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create custom lego",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    }
  };

  const handleRuntimeConfigSubmit = (config: Record<string, string>) => {
    RuntimeConfigService.applyConfig(config);
  };

  return ReactDOM.createPortal(
    <>
      {/* CSS Tanner Dialog */}
      <TannerDialog
        isOpen={cssTannerDialog}
        onClose={closeCssTannerDialog}
        onSubmit={handleCssTannerSubmit}
        title="Create CSS Tanner Network"
        cssOnly={true}
      />

      {/* Tanner Dialog */}
      <TannerDialog
        isOpen={tannerDialog}
        onClose={closeTannerDialog}
        onSubmit={handleTannerSubmit}
        title="Create Tanner Network"
      />

      {/* MSP Dialog */}
      <TannerDialog
        isOpen={mspDialog}
        onClose={closeMspDialog}
        onSubmit={handleMspSubmit}
        title="Measurement State Prep Network"
      />

      {/* Loading Modal */}
      <LoadingModal isOpen={loadingModal} message={loadingState.message} />

      {/* Custom Lego Dialog */}
      <TannerDialog
        isOpen={customLegoDialog}
        onClose={closeCustomLegoDialog}
        onSubmit={handleCustomLegoSubmit}
        title="Create Custom Lego"
      />

      {/* Auth Dialog */}
      <AuthDialog
        isOpen={authDialog}
        onClose={closeAuthDialog}
        connectionError={authState.connectionError}
      />

      {/* Runtime Config Dialog */}
      <RuntimeConfigDialog
        isOpen={runtimeConfigDialog}
        onClose={closeRuntimeConfigDialog}
        onSubmit={handleRuntimeConfigSubmit}
        isLocal={runtimeConfigState.isLocal}
        initialConfig={runtimeConfigState.initialConfig}
      />

      {/* Additional modals will be added here as we refactor them */}
    </>,
    document.getElementById("modal-root")!
  );
};
