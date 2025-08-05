import React from "react";
import ReactDOM from "react-dom";
import { TannerDialog } from "../features/network-apis/TannerDialog";
import LoadingModal from "./LoadingModal";
import AuthDialog from "../features/auth/AuthDialog";
import { RuntimeConfigDialog } from "../features/kernel/RuntimeConfigDialog";
import WeightEnumeratorCalculationDialog from "../features/weight-enumerator/WeightEnumeratorCalculationDialog";
import { ShareModal } from "../features/sharing/ShareModal";
import { ImportCanvasModal } from "../features/canvas/ImportCanvasModal";
import { AboutModal } from "../features/about/AboutModal";
import { NetworkService } from "../lib/networkService";
import { CustomLegoService } from "../features/lego/customLegoService";
import { RuntimeConfigService } from "../features/kernel/runtimeConfigService";
import { useToast } from "@chakra-ui/react";
import { User } from "@supabase/supabase-js";
import { TensorNetworkLeg } from "../lib/TensorNetwork";
import { useCanvasStore } from "../stores/canvasStateStore";
import { LegPartitionDialog } from "@/features/details-panel/LegPartitionDialog";
import { QuotasModal } from "@/features/quotas/QuotasModal";
import { DynamicLegoDialog } from "@/features/building-blocks-panel/DynamicLegoDialog";
import { PythonCodeModal } from "@/features/python-export/PythonCodeModal";
import HelpModal from "@/features/help-modal/HelpModal";

interface ModalRootProps {
  // Weight enumerator dependencies
  currentUser: User | null;
  setError?: (error: string) => void;
}

export const ModalRoot: React.FC<ModalRootProps> = ({
  currentUser,
  setError
}) => {
  const {
    cssTannerDialog,
    tannerDialog,
    mspDialog,
    loadingModal,
    customLegoDialog,
    authDialog,
    runtimeConfigDialog,
    shareDialog,
    importCanvasDialog,
    helpDialog,
    weightEnumeratorDialog,
    aboutDialog,
    loadingState,
    customLegoState,
    authState,
    runtimeConfigState,
    weightEnumeratorState,
    helpState,
    closeCssTannerDialog,
    closeTannerDialog,
    closeMspDialog,
    closeCustomLegoDialog,
    closeAuthDialog,
    closeRuntimeConfigDialog,
    closeShareDialog,
    closeImportCanvasDialog,
    closeHelpDialog,
    closeWeightEnumeratorDialog,
    closeAboutDialog,
    showLegPartitionDialog,
    closeLegPartitionDialog,
    handleLegPartitionDialogClose,
    handleUnfuseTo2LegosPartitionConfirm,
    unfuseLego,
    quotasDialog,
    closeQuotasDialog,
    isDynamicLegoDialogOpen,
    setIsDynamicLegoDialogOpen,
    selectedDynamicLego,
    setSelectedDynamicLego,
    setPendingDropPosition,
    handleDynamicLegoSubmit,
    showPythonCodeModal,
    setShowPythonCodeModal,
    pythonCode
  } = useCanvasStore();

  const toast = useToast();

  const handleCssTannerSubmit = async (matrix: number[][]) => {
    try {
      await NetworkService.createCssTannerNetwork(matrix);
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
      await NetworkService.createTannerNetwork(matrix);
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
      await NetworkService.createMspNetwork(matrix);
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

  const handleCustomLegoSubmit = async (
    matrix: number[][],
    logical_legs: number[]
  ) => {
    try {
      CustomLegoService.createCustomLego(
        matrix,
        logical_legs,
        customLegoState.position
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
    truncateLength?: number,
    openLegs?: TensorNetworkLeg[]
  ) => {
    if (!weightEnumeratorState.subNetwork || !setError) {
      return;
    }

    await useCanvasStore
      .getState()
      .calculateWeightEnumerator(currentUser!, toast, truncateLength, openLegs);
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
          showLogicalLegs={false}
          helpUrl="/docs/planqtn-studio/build/#css-tanner-layout"
        />
      )}

      {/* Tanner Dialog */}
      {tannerDialog && (
        <TannerDialog
          isOpen={tannerDialog}
          onClose={closeTannerDialog}
          onSubmit={handleTannerSubmit}
          title="Create Tanner Network"
          showLogicalLegs={false}
          helpUrl="/docs/planqtn-studio/build/#tanner-layout"
        />
      )}

      {/* MSP Dialog */}
      {mspDialog && (
        <TannerDialog
          isOpen={mspDialog}
          onClose={closeMspDialog}
          onSubmit={handleMspSubmit}
          title="Measurement State Prep Network"
          showLogicalLegs={false}
          helpUrl="/docs/planqtn-studio/build/#measurement-state-preparation-layout"
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
          showLogicalLegs={true}
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

      {/* Share Dialog */}
      {shareDialog && (
        <ShareModal isOpen={shareDialog} onClose={closeShareDialog} />
      )}

      {/* Import Canvas Dialog */}
      {importCanvasDialog && (
        <ImportCanvasModal
          isOpen={importCanvasDialog}
          onClose={closeImportCanvasDialog}
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

      {/* About Dialog */}
      {aboutDialog && (
        <AboutModal isOpen={aboutDialog} onClose={closeAboutDialog} />
      )}

      {showLegPartitionDialog && (
        <LegPartitionDialog
          open={showLegPartitionDialog}
          onClose={() => {
            closeLegPartitionDialog();
            handleLegPartitionDialogClose();
          }}
          onSubmit={(legPartition: number[]) => {
            closeLegPartitionDialog();
            handleLegPartitionDialogClose();
            handleUnfuseTo2LegosPartitionConfirm(legPartition);
          }}
          numLegs={unfuseLego ? unfuseLego.numberOfLegs : 0}
        />
      )}

      {quotasDialog && (
        <QuotasModal isOpen={quotasDialog} onClose={closeQuotasDialog} />
      )}

      {isDynamicLegoDialogOpen && (
        <DynamicLegoDialog
          isOpen={isDynamicLegoDialogOpen}
          onClose={() => {
            setIsDynamicLegoDialogOpen(false);
            setSelectedDynamicLego(null);
            setPendingDropPosition(null);
          }}
          onSubmit={handleDynamicLegoSubmit}
          legoId={selectedDynamicLego?.type_id || ""}
          parameters={selectedDynamicLego?.parameters || {}}
        />
      )}

      {showPythonCodeModal && (
        <PythonCodeModal
          isOpen={showPythonCodeModal}
          onClose={() => setShowPythonCodeModal(false)}
          code={pythonCode}
          title="Python Network Construction Code"
        />
      )}

      {helpDialog && (
        <HelpModal
          isOpen={helpDialog}
          onClose={closeHelpDialog}
          helpUrl={helpState.helpUrl}
          title={helpState.title}
        />
      )}
    </>,
    document.getElementById("modal-root")!
  );
};
