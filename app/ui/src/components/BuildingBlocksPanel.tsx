import {
  Box,
  List,
  ListItem,
  HStack,
  VStack,
  Text,
  Badge,
  useColorModeValue,
  Tooltip,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Button,
  Icon
} from "@chakra-ui/react";
import { DroppedLego, LegoPiece } from "../lib/types.ts";
import { DynamicLegoDialog } from "./DynamicLegoDialog.tsx";
import { useState, useRef, useEffect, useCallback, memo } from "react";
import {
  DroppedLegoDisplay,
  getLegoBoundingBox
} from "./DroppedLegoDisplay.tsx";
import { getLegoStyle } from "../LegoStyles.ts";
import { FiPackage, FiCpu, FiGrid, FiTarget } from "react-icons/fi";
import { Legos } from "../lib/Legos.ts";

interface BuildingBlocksPanelProps {
  onDragStart: (e: React.DragEvent<HTMLLIElement>, lego: LegoPiece) => void;
  onCreateCssTanner?: () => void;
  onCreateTanner?: () => void;
  onCreateMsp?: () => void;
  isUserLoggedIn?: boolean;
}

export const BuildingBlocksPanel: React.FC<BuildingBlocksPanelProps> = memo(
  ({
    onDragStart,
    onCreateCssTanner,
    onCreateTanner,
    onCreateMsp,
    isUserLoggedIn
  }) => {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedDynamicLego, setSelectedDynamicLego] =
      useState<LegoPiece | null>(null);
    const [isPanelSmall, setIsPanelSmall] = useState(false);
    const [panelWidth, setPanelWidth] = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);

    const [legos, setLegos] = useState<LegoPiece[]>([]);

    useEffect(() => {
      const fetchData = async () => {
        setLegos(Legos.listAvailableLegos());
      };

      fetchData();
    }, []);

    const checkPanelSize = useCallback(() => {
      // const rootFontSize = window.getComputedStyle(document.documentElement).fontSize;
      if (panelRef.current) {
        setIsPanelSmall(panelRef.current.offsetWidth < 200);
        setPanelWidth(panelRef.current.offsetWidth);
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

    const getDemoLego = (
      lego: LegoPiece
    ): {
      demoLego: DroppedLego;
      boundingBox: { left: number; top: number; width: number; height: number };
    } => {
      const numLegs = lego.parity_check_matrix[0].length / 2;
      const originLego = {
        ...lego,
        x: 0,
        y: 0,
        instanceId: lego.id,
        style: getLegoStyle(lego.id, numLegs),
        selectedMatrixRows: []
      } as DroppedLego;

      const boundingBox = getLegoBoundingBox(originLego, true);
      const demoLego = {
        ...originLego,
        x: -boundingBox.left / 2,
        y: -boundingBox.top / 2
      };

      return {
        demoLego,
        boundingBox: getLegoBoundingBox(demoLego, true)
      };
    };

    return (
      <Box
        ref={panelRef}
        height="100vh"
        minHeight={0}
        borderRight="1px"
        borderColor={borderColor}
        bg={bgColor}
        overflowY="auto"
        minW={0}
        maxW="100vw"
        display="flex"
        flexDirection="column"
      >
        {/* Modern Title Bar - Fixed at top */}
        <Box
          px={4}
          py={3}
          bgGradient="linear(to-r, teal.500, blue.500)"
          color="white"
          fontWeight="bold"
          fontSize="lg"
          boxShadow="sm"
          letterSpacing="wide"
          display="flex"
          alignItems="center"
          flexShrink={0}
          userSelect="none"
        >
          <Icon as={FiPackage} boxSize={5} mr={2} />
          Building Blocks
        </Box>

        {/* Scrollable Content Area */}
        <Box
          flex="1 1 0%"
          height={0}
          minHeight={0}
          overflowY="auto"
          px={2}
          pb={2}
        >
          <Accordion
            allowMultiple
            defaultIndex={[0]}
            borderRadius="md"
            bg="white"
          >
            {/* Tensors Section */}
            <AccordionItem border="none" mb={2}>
              {({ isExpanded }) => (
                <>
                  <AccordionButton
                    bg={isExpanded ? "teal.100" : "gray.50"}
                    _hover={{ bg: "teal.50" }}
                    borderRadius="md"
                    px={4}
                    py={2}
                    fontWeight="bold"
                    fontSize="md"
                    transition="background 0.2s"
                    userSelect="none"
                    _focus={{ boxShadow: "none" }}
                  >
                    <Box flex="1" textAlign="left" color="teal.700">
                      Tensors
                    </Box>
                    <AccordionIcon />
                  </AccordionButton>
                  <AccordionPanel pb={4} pl={0}>
                    <List spacing={3}>
                      {/* Existing Legos */}
                      {[...legos, customLego].map((lego) => {
                        const { demoLego, boundingBox } = getDemoLego(lego);
                        return (
                          <ListItem
                            key={lego.id}
                            p={2}
                            borderRadius="md"
                            height="auto"
                            width="auto"
                            _hover={{ bg: "gray.50" }}
                            cursor="move"
                            draggable
                            onDragStart={(e) => handleDragStart(e, lego)}
                          >
                            <Tooltip
                              label={lego.name}
                              placement="right"
                              isDisabled={!isPanelSmall}
                            >
                              <HStack
                                p={1}
                                spacing={3}
                                justify={isPanelSmall ? "center" : "flex-start"}
                              >
                                <Box
                                  position={"relative"}
                                  left={isPanelSmall ? "0" : "0"}
                                  top={isPanelSmall ? "0" : "0"}
                                  style={{
                                    marginLeft: isPanelSmall
                                      ? panelWidth / 4 -
                                        boundingBox.width / 4 +
                                        "px"
                                      : "0"
                                  }}
                                  display="block"
                                  height={boundingBox.height / 2 + "px"}
                                  width={
                                    isPanelSmall
                                      ? "100%"
                                      : boundingBox.width / 2 + "px"
                                  }
                                >
                                  <DroppedLegoDisplay
                                    lego={demoLego}
                                    connections={[]}
                                    index={0}
                                    legDragState={null}
                                    handleLegMouseDown={() => {}}
                                    handleLegoMouseDown={() => {}}
                                    handleLegoClick={() => {}}
                                    tensorNetwork={null}
                                    dragState={null}
                                    hideConnectedLegs={false}
                                    droppedLegos={[]}
                                    demoMode={true}
                                  />
                                </Box>
                                {!isPanelSmall && (
                                  <VStack align="start" spacing={0.5}>
                                    {lego.is_dynamic && (
                                      <Badge colorScheme="green">Dynamic</Badge>
                                    )}
                                    <Text
                                      display="block"
                                      fontWeight="bold"
                                      fontSize="1rem"
                                      whiteSpace="nowrap"
                                    >
                                      {lego.name}
                                    </Text>
                                  </VStack>
                                )}
                              </HStack>
                            </Tooltip>
                          </ListItem>
                        );
                      })}
                    </List>
                  </AccordionPanel>
                </>
              )}
            </AccordionItem>

            {/* Networks Section */}
            <AccordionItem border="none" borderRadius="md">
              {({ isExpanded }) => (
                <>
                  <AccordionButton
                    bg={isExpanded ? "blue.100" : "gray.50"}
                    _hover={{ bg: "blue.50" }}
                    borderRadius="md"
                    px={4}
                    py={2}
                    fontWeight="bold"
                    fontSize="md"
                    transition="background 0.2s"
                    userSelect="none"
                    _focus={{ boxShadow: "none" }}
                  >
                    <Box flex="1" textAlign="left" color="blue.700">
                      Networks
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
                          variant="outline"
                          colorScheme="blue"
                          onClick={onCreateCssTanner}
                          isDisabled={!isUserLoggedIn}
                          justifyContent="flex-start"
                          title={!isUserLoggedIn ? "Needs signing in" : ""}
                          leftIcon={<Icon as={FiCpu} />}
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
                          variant="outline"
                          colorScheme="blue"
                          onClick={onCreateTanner}
                          isDisabled={!isUserLoggedIn}
                          justifyContent="flex-start"
                          title={!isUserLoggedIn ? "Needs signing in" : ""}
                          leftIcon={<Icon as={FiGrid} />}
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
                          variant="outline"
                          colorScheme="blue"
                          onClick={onCreateMsp}
                          isDisabled={!isUserLoggedIn}
                          justifyContent="flex-start"
                          title={!isUserLoggedIn ? "Needs signing in" : ""}
                          leftIcon={<Icon as={FiTarget} />}
                        >
                          {isPanelSmall
                            ? "MSP"
                            : "Measurement State Prep Network"}
                        </Button>
                      </Tooltip>
                    </VStack>
                  </AccordionPanel>
                </>
              )}
            </AccordionItem>
          </Accordion>
        </Box>

        <DynamicLegoDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedDynamicLego(null);
          }}
          onSubmit={() => {}}
          legoId={selectedDynamicLego?.id || ""}
          parameters={selectedDynamicLego?.parameters || {}}
        />
      </Box>
    );
  }
);

BuildingBlocksPanel.displayName = "BuildingBlocksPanel";

export default BuildingBlocksPanel;
