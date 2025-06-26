import React from "react";
import ReactDOM from "react-dom";
import { useModalStore } from "../stores/modalStore";
import { TannerDialog } from "./TannerDialog";
import LoadingModal from "./LoadingModal";
import AuthDialog from "./AuthDialog";
import { RuntimeConfigDialog } from "./RuntimeConfigDialog";
import WeightEnumeratorCalculationDialog from "./WeightEnumeratorCalculationDialog";
import { NetworkService, NetworkCreationOptions } from "../lib/networkService";
import {
  CustomLegoService,
  CustomLegoCreationOptions
} from "../lib/customLegoService";
import { RuntimeConfigService } from "../lib/runtimeConfigService";
import { WeightEnumeratorService } from "../lib/weightEnumeratorService";
import { OperationHistory } from "../lib/OperationHistory";
import { CanvasStateSerializer } from "../lib/CanvasStateSerializer";
import { useToast } from "@chakra-ui/react";
import { User } from "@supabase/supabase-js";
import { TensorNetworkLeg } from "../lib/TensorNetwork";

interface ModalRootProps {
  operationHistory: OperationHistory;
  stateSerializer: CanvasStateSerializer;
  hideConnectedLegs: boolean;
  newInstanceId: () => string;
  // Weight enumerator dependencies
  currentUser: User | null;
  setError?: (error: string) => void;
  weightEnumeratorCache?: Map<
    string,
    {
      taskId: string;
      polynomial: string;
      normalizerPolynomial: string;
      truncateLength: number | null;
    }
  >;
}

export const ModalRoot: React.FC<ModalRootProps> = ({
  operationHistory,
  stateSerializer,
  hideConnectedLegs,
  newInstanceId,
  currentUser,
  setError,
  weightEnumeratorCache
}) => {
  const {
    cssTannerDialog,
    tannerDialog,
    mspDialog,
    loadingModal,
    customLegoDialog,
    authDialog,
    runtimeConfigDialog,
    weightEnumeratorDialog,
    loadingState,
    customLegoState,
    authState,
    runtimeConfigState,
    weightEnumeratorState,
    closeCssTannerDialog,
    closeTannerDialog,
    closeMspDialog,
    closeCustomLegoDialog,
    closeAuthDialog,
    closeRuntimeConfigDialog,
    closeWeightEnumeratorDialog
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

  const handleWeightEnumeratorSubmit = async (
    truncateLength: number | null,
    openLegs: TensorNetworkLeg[]
  ) => {
    if (
      !weightEnumeratorState.subNetwork ||
      !setError ||
      !weightEnumeratorCache
    ) {
      return;
    }

    await WeightEnumeratorService.calculateWeightEnumerator(
      weightEnumeratorState.subNetwork,
      truncateLength,
      openLegs,
      {
        currentUser: currentUser!,
        setError,
        toast,
        weightEnumeratorCache
      }
    );
  };

  return ReactDOM.createPortal(
    <>
      {/* CSS Tanner Dialog */}
      {cssTannerDialog && (
        <TannerDialog
          isOpen={cssTannerDialog}
          onClose={closeCssTannerDialog}
          onSubmit={handleCssTannerSubmit}
          title="Create CSS Tanner Network"
          cssOnly={true}
        />
      )}

      {/* Tanner Dialog */}
      {tannerDialog && (
        <TannerDialog
          isOpen={tannerDialog}
          onClose={closeTannerDialog}
          onSubmit={handleTannerSubmit}
          title="Create Tanner Network"
        />
      )}

      {/* MSP Dialog */}
      {mspDialog && (
        <TannerDialog
          isOpen={mspDialog}
          onClose={closeMspDialog}
          onSubmit={handleMspSubmit}
          title="Measurement State Prep Network"
        />
      )}

      {/* Loading Modal */}
      {loadingModal && (
        <LoadingModal isOpen={loadingModal} message={loadingState.message} />
      )}

      {/* Custom Lego Dialog */}
      {customLegoDialog && (
        <TannerDialog
          isOpen={customLegoDialog}
          onClose={closeCustomLegoDialog}
          onSubmit={handleCustomLegoSubmit}
          title="Create Custom Lego"
        />
      )}

      {/* Auth Dialog */}
      {authDialog && (
        <AuthDialog
          isOpen={authDialog}
          onClose={closeAuthDialog}
          connectionError={authState.connectionError}
        />
      )}

      {/* Runtime Config Dialog */}
      {runtimeConfigDialog && (
        <RuntimeConfigDialog
          isOpen={runtimeConfigDialog}
          onClose={closeRuntimeConfigDialog}
          onSubmit={handleRuntimeConfigSubmit}
          isLocal={runtimeConfigState.isLocal}
          initialConfig={runtimeConfigState.initialConfig}
        />
      )}

      {/* Weight Enumerator Dialog */}
      {weightEnumeratorDialog && weightEnumeratorState.subNetwork && (
        <WeightEnumeratorCalculationDialog
          open={weightEnumeratorDialog}
          onClose={closeWeightEnumeratorDialog}
          onSubmit={handleWeightEnumeratorSubmit}
          subNetwork={weightEnumeratorState.subNetwork}
          mainNetworkConnections={weightEnumeratorState.mainNetworkConnections}
        />
      )}

      {/* Additional modals will be added here as we refactor them */}
    </>,
    document.getElementById("modal-root")!
  );
};
