import {
  Box,
  Heading,
  List,
  ListItem,
  HStack,
  VStack,
  Text,
  Badge,
  useColorModeValue,
  useToast,
  Tooltip,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button
} from "@chakra-ui/react";
import { LegoPiece } from "../lib/types.ts";
import { DynamicLegoDialog } from "./DynamicLegoDialog.tsx";
import { useState, useRef, useEffect, useCallback } from "react";
import { DroppedLegoDisplay } from "./DroppedLegoDisplay.tsx";
import { getLegoStyle } from "../LegoStyles.ts";
import { Legos } from "../lib/Legos.ts";

interface BuildingBlocksPanelProps {
  legos: LegoPiece[];
  onLegoSelect: (lego: LegoPiece) => void;
  onDragStart: (e: React.DragEvent<HTMLLIElement>, lego: LegoPiece) => void;
  onCreateCssTanner?: () => void;
  onCreateTanner?: () => void;
  onCreateMsp?: () => void;
  isUserLoggedIn?: boolean;
}

export const BuildingBlocksPanel: React.FC<BuildingBlocksPanelProps> = ({
  legos,
  onLegoSelect,
  onDragStart,
  onCreateCssTanner,
  onCreateTanner,
  onCreateMsp,
  isUserLoggedIn
}) => {
  const toast = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDynamicLego, setSelectedDynamicLego] =
    useState<LegoPiece | null>(null);
  const [isPanelSmall, setIsPanelSmall] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const checkPanelSize = useCallback(() => {
    if (panelRef.current) {
      // With accordion structure, we need a slightly higher threshold
      // since accordion headers take up additional space
      setIsPanelSmall(panelRef.current.offsetWidth < 300);
    }
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(checkPanelSize);
    const currentPanelRef = panelRef.current;
    if (currentPanelRef) {
      observer.observe(currentPanelRef);
    }

    window.addEventListener("resize", checkPanelSize);
    // Note: 'zoom' event is non-standard, but works in some browsers.
    // resize is a good fallback.
    window.addEventListener("zoom", checkPanelSize);

    // Initial check
    checkPanelSize();

    return () => {
      if (currentPanelRef) {
        observer.unobserve(currentPanelRef);
      }
      window.removeEventListener("resize", checkPanelSize);
      window.removeEventListener("zoom", checkPanelSize);
    };
  }, [checkPanelSize]);

  const handleDragStart = (
    e: React.DragEvent<HTMLLIElement>,
    lego: LegoPiece
  ) => {
    onDragStart(e, lego);
  };

  const handleDynamicLegoSubmit = async (
    parameters: Record<string, unknown>
  ) => {
    if (!selectedDynamicLego) return;

    try {
      const dynamicLego = Legos.getDynamicLego({
        lego_id: selectedDynamicLego.id,
        parameters
      });
      onLegoSelect(dynamicLego);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create dynamic lego (" + error + ")",
        status: "error",
        duration: 3000,
        isClosable: true
      });
    }
  };

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  // Create custom lego piece
  const customLego: LegoPiece = {
    id: "custom",
    name: "Custom Lego",
    shortName: "Custom",
    description:
      "Create a custom lego with specified parity check matrix and logical legs",
    parity_check_matrix: [
      [1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 1, 1]
    ],
    is_dynamic: true,
    logical_legs: [],
    gauge_legs: []
  };

  return (
    <Box
      ref={panelRef}
      h="100%"
      borderRight="1px"
      borderColor={borderColor}
      bg={bgColor}
      overflowY="auto"
    >
      <VStack align="stretch" spacing={4} p={4}>
        <Heading size="xs" backgroundColor="gray.100" padding={2}>
          Building Blocks
        </Heading>
        <Accordion allowMultiple defaultIndex={[0]}>
          {/* Tensors Section */}
          <AccordionItem>
            <AccordionButton backgroundColor="green.100">
              <Box as="span" flex="1" textAlign="left">
                <Heading size="xs">Tensors</Heading>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4} pl={0}>
              <List spacing={3}>
                {/* Existing Legos */}
                {[...legos, customLego].map((lego) => {
                  const numLegs = lego.parity_check_matrix[0].length / 2;
                  return (
                    <ListItem
                      key={lego.id}
                      p={2}
                      borderWidth="1px"
                      borderRadius="md"
                      _hover={{ bg: "gray.50" }}
                      cursor="move"
                      draggable
                      onDragStart={(e) => handleDragStart(e, lego)}
                    >
                      <HStack p={0.5} spacing={0.5}>
                        <Tooltip
                          label={lego.name}
                          placement="right"
                          isDisabled={!isPanelSmall}
                        >
                          <Box position="relative" w={50} h={50}>
                            <DroppedLegoDisplay
                              lego={{
                                ...lego,
                                x: numLegs <= 3 ? 13 : 5,
                                y: numLegs <= 3 ? 20 : 13,
                                instanceId: lego.id,
                                style: getLegoStyle(lego.id, numLegs),
                                selectedMatrixRows: []
                              }}
                              connections={[]}
                              index={0}
                              legDragState={null}
                              handleLegMouseDown={() => {}}
                              handleLegoMouseDown={() => {}}
                              handleLegoClick={() => {}}
                              tensorNetwork={null}
                              selectedLego={null}
                              dragState={null}
                              hideConnectedLegs={false}
                              droppedLegos={[]}
                              demoMode={true}
                            />
                          </Box>
                        </Tooltip>
                        {!isPanelSmall && (
                          <VStack align="start" spacing={0.5}>
                            {lego.is_dynamic && (
                              <Badge colorScheme="green">Dynamic</Badge>
                            )}
                            <Text
                              display="block"
                              fontWeight="bold"
                              fontSize="sm"
                              whiteSpace="nowrap"
                            >
                              {lego.name}
                            </Text>
                          </VStack>
                        )}
                      </HStack>
                    </ListItem>
                  );
                })}
              </List>
            </AccordionPanel>
          </AccordionItem>

          {/* Networks Section */}
          <AccordionItem>
            <AccordionButton backgroundColor="blue.100">
              <Box as="span" flex="1" textAlign="left">
                <Heading size="xs">Networks</Heading>
              </Box>
              <AccordionIcon />
            </AccordionButton>
            <AccordionPanel pb={4} pl={0}>
              <VStack spacing={3} align="stretch">
                <Tooltip
                  label={"CSS Tanner Network"}
                  placement="right"
                  isDisabled={!isPanelSmall}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCreateCssTanner}
                    isDisabled={!isUserLoggedIn}
                    justifyContent="flex-start"
                    title={!isUserLoggedIn ? "Needs signing in" : ""}
                  >
                    {isPanelSmall ? "CSS" : "CSS Tanner Network"}
                  </Button>
                </Tooltip>
                <Tooltip
                  label={"Tanner Network"}
                  placement="right"
                  isDisabled={!isPanelSmall}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCreateTanner}
                    isDisabled={!isUserLoggedIn}
                    justifyContent="flex-start"
                    title={!isUserLoggedIn ? "Needs signing in" : ""}
                  >
                    {isPanelSmall ? "Tanner" : "Tanner Network"}
                  </Button>
                </Tooltip>
                <Tooltip
                  label={"Measurement State Prep Network"}
                  placement="right"
                  isDisabled={!isPanelSmall}
                >
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onCreateMsp}
                    isDisabled={!isUserLoggedIn}
                    justifyContent="flex-start"
                    title={!isUserLoggedIn ? "Needs signing in" : ""}
                  >
                    {isPanelSmall ? "MSP" : "Measurement State Prep Network"}
                  </Button>
                </Tooltip>
              </VStack>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </VStack>

      <DynamicLegoDialog
        isOpen={isDialogOpen}
        onClose={() => {
          setIsDialogOpen(false);
          setSelectedDynamicLego(null);
        }}
        onSubmit={handleDynamicLegoSubmit}
        legoId={selectedDynamicLego?.id || ""}
        parameters={selectedDynamicLego?.parameters || {}}
      />
    </Box>
  );
};

export default BuildingBlocksPanel;
