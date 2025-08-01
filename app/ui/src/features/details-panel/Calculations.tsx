import {
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Box,
  Text,
  useColorModeValue
} from "@chakra-ui/react";
import ParityCheckMatrix from "./ParityCheckMatrix";
import WeightEnumerators from "./WeightEnumerators";
import { Task } from "../../lib/types";
import { RealtimeChannel } from "@supabase/supabase-js";
import { TaskUpdateIterationStatus } from "../../lib/types";
import { TensorNetwork } from "@/lib/TensorNetwork";
import { DroppedLego } from "@/stores/droppedLegoStore";

interface CalculationsProps {
  tensorNetwork: TensorNetwork | null;
  lego: DroppedLego | null;
  isSingleLego: boolean;
  parityCheckMatrix: any;
  selectedRows: number[];
  singleLegoLegOrdering: Array<{ instance_id: string; leg_index: number }>;
  weightEnumerators: any[];
  tasks: Map<string, Task>;
  iterationStatuses: Map<string, Array<TaskUpdateIterationStatus>>;
  waitingForTaskUpdates: Map<string, boolean>;
  taskUpdatesChannels: Map<string, RealtimeChannel>;
  onCalculatePCM: () => void;
  onRowSelectionChange: (rows: number[]) => void;
  onMatrixChange: (matrix: number[][]) => void;
  onRecalculate?: () => void;
  onCancelTask: (taskId: string) => void;
  onViewLogs: (taskId: string) => void;
  signature?: string;
}

const Calculations: React.FC<CalculationsProps> = ({
  tensorNetwork,
  lego,
  isSingleLego,
  parityCheckMatrix,
  selectedRows,
  singleLegoLegOrdering,
  weightEnumerators,
  tasks,
  iterationStatuses,
  waitingForTaskUpdates,
  taskUpdatesChannels,
  onCalculatePCM,
  onRowSelectionChange,
  onMatrixChange,
  onRecalculate,
  onCancelTask,
  onViewLogs,
  signature
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  // If no tensor network is selected, don't render anything
  if (!tensorNetwork) {
    return null;
  }

  return (
    <Accordion allowMultiple defaultIndex={[0, 1]} p={0}>
      <AccordionItem border="none">
        <AccordionButton
          px={4}
          py={3}
          bg={bgColor}
          borderBottom="1px"
          borderColor={borderColor}
          _hover={{ bg: useColorModeValue("gray.50", "gray.700") }}
        >
          <Box as="span" flex="1" textAlign="left">
            <Text fontSize="sm" fontWeight="medium">
              Parity Check Matrix
            </Text>
          </Box>
          <AccordionIcon />
        </AccordionButton>
        <AccordionPanel pb={0} pt={0}>
          <ParityCheckMatrix
            tensorNetwork={tensorNetwork}
            lego={lego}
            isSingleLego={isSingleLego}
            parityCheckMatrix={parityCheckMatrix}
            selectedRows={selectedRows}
            singleLegoLegOrdering={singleLegoLegOrdering}
            onCalculatePCM={onCalculatePCM}
            onRowSelectionChange={onRowSelectionChange}
            onMatrixChange={onMatrixChange}
            onRecalculate={onRecalculate}
            signature={signature}
          />
        </AccordionPanel>
      </AccordionItem>

      <AccordionItem border="none">
        <AccordionButton
          px={4}
          py={3}
          bg={bgColor}
          borderBottom="1px"
          borderColor={borderColor}
          _hover={{ bg: useColorModeValue("gray.50", "gray.700") }}
        >
          <Box as="span" flex="1" textAlign="left">
            <Text fontSize="sm" fontWeight="medium">
              Weight Enumerators
            </Text>
          </Box>
          <AccordionIcon />
        </AccordionButton>
        <AccordionPanel pb={0} pt={0}>
          <WeightEnumerators
            tensorNetwork={tensorNetwork}
            weightEnumerators={weightEnumerators}
            tasks={tasks}
            iterationStatuses={iterationStatuses}
            waitingForTaskUpdates={waitingForTaskUpdates}
            taskUpdatesChannels={taskUpdatesChannels}
            onCancelTask={onCancelTask}
            onViewLogs={onViewLogs}
          />
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
};

export default Calculations;
