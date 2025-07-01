import {
  Box,
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
import { useState, useRef, useEffect, useCallback, memo, useMemo } from "react";
import { getLegoBoundingBox } from "../lego/DroppedLegoDisplay.tsx";
import { DroppedLego, LegoPiece } from "../../stores/droppedLegoStore.ts";
import { FiPackage, FiCpu, FiGrid, FiTarget } from "react-icons/fi";
import { Legos } from "../lego/Legos.ts";
import { LegoSvgRenderer } from "../lego/LegoSvgRenderer.ts";
import { useModalStore } from "../../stores/modalStore.ts";
import { useDraggedLegoStore } from "../../stores/draggedLegoProtoStore.ts";
import { useCanvasStore } from "../../stores/canvasStateStore.ts";
import { useBuildingBlockDragStateStore } from "../../stores/buildingBlockDragStateStore.ts";

interface BuildingBlocksPanelProps {
  isUserLoggedIn?: boolean;
}

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
  const originLego = new DroppedLego(lego, 0, 0, "-1");

  const boundingBox = getLegoBoundingBox(originLego, true);
  const demoLego = originLego.with({
    x: -boundingBox.left / 2,
    y: -boundingBox.top / 2
  });

  return {
    demoLego,
    boundingBox: getLegoBoundingBox(demoLego, true)
  };
};

interface LegoListItemProps {
  lego: LegoPiece;
  isPanelSmall: boolean;
  handleDragStart: (e: React.DragEvent<HTMLElement>, lego: LegoPiece) => void;
}

const LegoListItem = memo<LegoListItemProps>(
  ({ lego, isPanelSmall, handleDragStart }) => {
    const { demoLego, boundingBox } = useMemo(() => getDemoLego(lego), [lego]);

    if (isPanelSmall) {
      return (
        <Tooltip key={lego.id} label={lego.name} placement="top">
          <Box
            p={2}
            borderRadius="md"
            _hover={{ bg: "gray.50" }}
            cursor="move"
            draggable
            onDragStart={(e) => handleDragStart(e, lego)}
            display="flex"
            flexDirection="column"
            alignItems="center"
            minH="80px"
            justifyContent="space-between"
          >
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              width="50px"
              height="50px"
              flex="1"
            >
              <svg
                width={Math.min(boundingBox.width * 0.3, 40)}
                height={Math.min(boundingBox.height * 0.3, 40)}
                viewBox={`${boundingBox.left} ${boundingBox.top} ${boundingBox.width} ${boundingBox.height}`}
                style={{
                  overflow: "visible"
                }}
                dangerouslySetInnerHTML={{
                  __html: LegoSvgRenderer.renderLegoAsSVG(demoLego, {
                    demoMode: true
                  })
                }}
              />
            </Box>
            <Box height="14px" display="flex" alignItems="center">
              {lego.is_dynamic && (
                <Badge
                  colorScheme="green"
                  size="xs"
                  fontSize="8px"
                  px={1}
                  py={0}
                  height="12px"
                  minW="auto"
                >
                  DYN
                </Badge>
              )}
            </Box>
          </Box>
        </Tooltip>
      );
    }

    return (
      <Box
        key={lego.id}
        p={3}
        borderRadius="md"
        _hover={{ bg: "gray.50" }}
        cursor="move"
        draggable
        onDragStart={(e) => handleDragStart(e, lego)}
        border="1px solid"
        borderColor="gray.200"
      >
        <HStack spacing={4} align="center">
          <Box
            display="flex"
            alignItems="center"
            justifyContent="center"
            width="60px"
            height="60px"
            flexShrink={0}
          >
            <svg
              width={Math.min(boundingBox.width * 0.4, 50)}
              height={Math.min(boundingBox.height * 0.4, 50)}
              viewBox={`${boundingBox.left} ${boundingBox.top} ${boundingBox.width} ${boundingBox.height}`}
              style={{
                overflow: "visible"
              }}
              dangerouslySetInnerHTML={{
                __html: LegoSvgRenderer.renderLegoAsSVG(demoLego, {
                  demoMode: true
                })
              }}
            />
          </Box>
          <VStack align="start" spacing={1} flex={1}>
            <Text fontWeight="bold" fontSize="sm" color="gray.800">
              {lego.name}
            </Text>
            <Text fontSize="xs" color="gray.600" noOfLines={2}>
              {lego.description}
            </Text>
            {lego.is_dynamic && (
              <Badge colorScheme="green" size="xs" mt={1}>
                Dynamic
              </Badge>
            )}
          </VStack>
        </HStack>
      </Box>
    );
  }
);
LegoListItem.displayName = "LegoListItem";

export const BuildingBlocksPanel: React.FC<BuildingBlocksPanelProps> = memo(
  ({ isUserLoggedIn }) => {
    const [isPanelSmall, setIsPanelSmall] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const { openCssTannerDialog, openTannerDialog, openMspDialog } =
      useModalStore.getState();
    const [legos, setLegos] = useState<LegoPiece[]>([]);
    const setDraggedLego = useDraggedLegoStore(
      (state) => state.setDraggedLegoProto
    );
    const setBuildingBlockDragState = useBuildingBlockDragStateStore(
      (state) => state.setBuildingBlockDragState
    );
    const newInstanceId = useCanvasStore((state) => state.newInstanceId);

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

    const handleDragStart = useCallback(
      (e: React.DragEvent<HTMLElement>, lego: LegoPiece) => {
        // Hide the default drag ghost by setting a transparent image
        const dragImage = new Image();
        dragImage.src =
          "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs=";
        e.dataTransfer.setDragImage(dragImage, 0, 0);

        if (lego.id === "custom") {
          // Store the drop position for the custom lego
          const rect = e.currentTarget.getBoundingClientRect();
          // Note: position will be set when the custom lego is dropped, not during drag start
          // Set the draggedLego state for custom legos

          const draggedLego: DroppedLego = new DroppedLego(
            lego,
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            newInstanceId()
          );
          setDraggedLego(draggedLego);
          setBuildingBlockDragState({
            isDragging: true,
            draggedLego: lego,
            mouseX: e.clientX,
            mouseY: e.clientY,
            dragEnterCounter: 0
          });
        } else {
          // Handle regular lego drag
          const rect = e.currentTarget.getBoundingClientRect();
          const draggedLego: DroppedLego = new DroppedLego(
            lego,
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            newInstanceId()
          );
          setDraggedLego(draggedLego);
          setBuildingBlockDragState({
            isDragging: true,
            draggedLego: lego,
            mouseX: e.clientX,
            mouseY: e.clientY,
            dragEnterCounter: 0
          });
        }
      },
      [newInstanceId, setBuildingBlockDragState, setDraggedLego]
    );

    const bgColor = useColorModeValue("white", "gray.800");
    const borderColor = useColorModeValue("gray.200", "gray.600");

    const allLegos = useMemo(() => [...legos, customLego], [legos]);

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
                    {isPanelSmall ? (
                      // Grid layout for small panels
                      <Box
                        display="grid"
                        gridTemplateColumns="repeat(auto-fit, minmax(60px, 1fr))"
                        gap={2}
                        justifyItems="center"
                      >
                        {allLegos.map((lego) => (
                          <LegoListItem
                            key={lego.id}
                            lego={lego}
                            isPanelSmall={isPanelSmall}
                            handleDragStart={handleDragStart}
                          />
                        ))}
                      </Box>
                    ) : (
                      // List layout for normal panels
                      <VStack spacing={2} align="stretch">
                        {allLegos.map((lego) => (
                          <LegoListItem
                            key={lego.id}
                            lego={lego}
                            isPanelSmall={isPanelSmall}
                            handleDragStart={handleDragStart}
                          />
                        ))}
                      </VStack>
                    )}
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
                          onClick={() => openCssTannerDialog()}
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
                          onClick={() => openTannerDialog()}
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
                          onClick={() => openMspDialog()}
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
      </Box>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.isUserLoggedIn === nextProps.isUserLoggedIn;
  }
);

BuildingBlocksPanel.displayName = "BuildingBlocksPanel";

export default BuildingBlocksPanel;
