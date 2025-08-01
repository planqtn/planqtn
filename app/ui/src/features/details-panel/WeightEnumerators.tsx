import {
  Box,
  VStack,
  Text,
  Button,
  useColorModeValue,
  Badge,
  HStack,
  Center,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  IconButton
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { Task } from "../../lib/types";
import TaskDetailsDisplay from "../tasks/TaskDetailsDisplay";
import TaskStateLabel from "../tasks/TaskStateLabel";
import { RealtimeChannel } from "@supabase/supabase-js";
import { TaskUpdateIterationStatus } from "../../lib/types";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { useUserStore } from "@/stores/userStore";

interface WeightEnumeratorsProps {
  tensorNetwork: any;
  weightEnumerators: any[];
  tasks: Map<string, Task>;
  iterationStatuses: Map<string, Array<TaskUpdateIterationStatus>>;
  waitingForTaskUpdates: Map<string, boolean>;
  taskUpdatesChannels: Map<string, RealtimeChannel>;
  onCancelTask: (taskId: string) => void;
  onViewLogs: (taskId: string) => void;
}

const WeightEnumerators: React.FC<WeightEnumeratorsProps> = ({
  tensorNetwork,
  weightEnumerators,
  tasks,
  iterationStatuses,
  waitingForTaskUpdates,
  taskUpdatesChannels,
  onCancelTask,
  onViewLogs
}) => {
  const bgColor = useColorModeValue("white", "gray.800");

  const openWeightEnumeratorDialog = useCanvasStore(
    (state) => state.openWeightEnumeratorDialog
  );
  const connections = useCanvasStore((state) => state.connections);
  const deleteWeightEnumerator = useCanvasStore(
    (state) => state.deleteWeightEnumerator
  );

  const handleRunWeightEnumerator = () => {
    if (tensorNetwork) {
      openWeightEnumeratorDialog(tensorNetwork, connections);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (tensorNetwork) {
      deleteWeightEnumerator(tensorNetwork.signature, taskId);
    }
  };

  const isUserLoggedIn = useUserStore((state) => state.isUserLoggedIn);

  if (!tensorNetwork || weightEnumerators.length === 0) {
    return (
      <VStack align="stretch" spacing={2} p={2}>
        <Center h="60px">
          <VStack spacing={2}>
            <Text fontSize="sm" color="gray.600" textAlign="center">
              No weight enumerator calculations yet
            </Text>
            <Button
              colorScheme="blue"
              size="sm"
              onClick={handleRunWeightEnumerator}
              disabled={!isUserLoggedIn}
            >
              Run a weight enumerator calculation
            </Button>
          </VStack>
        </Center>
      </VStack>
    );
  }

  return (
    <VStack align="stretch" spacing={2} p={2}>
      <Box p={2} borderWidth={0} borderRadius="md" bg={bgColor}>
        <Center>
          <Button
            colorScheme="blue"
            size="sm"
            onClick={handleRunWeightEnumerator}
          >
            Run a weight enumerator calculation
          </Button>
        </Center>
      </Box>

      <Accordion
        allowMultiple
        defaultIndex={weightEnumerators.map((_, index) => index)}
      >
        {weightEnumerators.map((enumerator, index) => {
          const taskId = enumerator.taskId;
          if (!taskId) return null;

          const task = tasks.get(taskId) || null;
          const taskIterationStatus = iterationStatuses.get(taskId) || [];
          const isWaitingForUpdate = waitingForTaskUpdates.get(taskId) || false;
          const taskChannel = taskUpdatesChannels.get(taskId) || null;

          return (
            <AccordionItem key={taskId} border="none">
              <AccordionButton p={2} _hover={{ bg: "gray.50" }}>
                <Box flex="1" textAlign="left">
                  <VStack align="stretch" spacing={1}>
                    <HStack justify="space-between" align="center">
                      <Text fontSize="sm" fontWeight="medium">
                        Task #{index + 1}
                      </Text>
                      <HStack spacing={1}>
                        {task && <TaskStateLabel state={task.state} />}
                        {enumerator.truncateLength && (
                          <Badge size="sm" colorScheme="purple">
                            T{enumerator.truncateLength}
                          </Badge>
                        )}
                        {enumerator.openLegs.length > 0 ? (
                          <Badge size="sm" colorScheme="orange">
                            {enumerator.openLegs.length} open legs
                          </Badge>
                        ) : (
                          <Badge size="sm" colorScheme="gray">
                            SCALAR
                          </Badge>
                        )}
                        <IconButton
                          aria-label="Delete task"
                          icon={<DeleteIcon />}
                          size="xs"
                          variant="ghost"
                          colorScheme="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTask(taskId);
                          }}
                        />
                      </HStack>
                    </HStack>
                    <VStack align="stretch" spacing={0}>
                      <Text fontSize="xs" color="gray.500" fontFamily="mono">
                        ID: {taskId}
                      </Text>
                      {task?.sent_at && (
                        <Text fontSize="xs" color="gray.500" fontFamily="mono">
                          Created: {new Date(task.sent_at).toLocaleString()}
                        </Text>
                      )}
                      {task?.started_at && task?.ended_at && (
                        <Text fontSize="xs" color="gray.500" fontFamily="mono">
                          Duration:{" "}
                          {(
                            (new Date(task.ended_at).getTime() -
                              new Date(task.started_at).getTime()) /
                            1000
                          ).toFixed(2)}
                          s
                        </Text>
                      )}
                      {task?.state === 2 &&
                        task?.result &&
                        (() => {
                          try {
                            const parsedResult = JSON.parse(task.result);
                            if (parsedResult.time) {
                              return (
                                <Text
                                  fontSize="xs"
                                  color="gray.500"
                                  fontFamily="mono"
                                >
                                  Execution: {parsedResult.time.toFixed(2)}s
                                </Text>
                              );
                            }
                          } catch (e) {
                            // Ignore parsing errors
                          }
                          return null;
                        })()}
                    </VStack>
                  </VStack>
                </Box>
                <AccordionIcon />
              </AccordionButton>
              <AccordionPanel pb={2} pt={0}>
                <VStack align="stretch" spacing={1}>
                  {/* Display open legs */}
                  {enumerator.openLegs.length > 0 && (
                    <VStack align="stretch" spacing={1}>
                      <Text fontSize="xs" fontWeight="medium" color="gray.600">
                        Open Legs:
                      </Text>
                      <Box
                        p={1}
                        borderWidth={0}
                        borderRadius="sm"
                        bg="gray.50"
                        maxH="100px"
                        overflowY="auto"
                      >
                        <Table size="sm" variant="simple">
                          <Thead>
                            <Tr>
                              <Th fontSize="xs" py={1} px={2}>
                                Instance ID
                              </Th>
                              <Th fontSize="xs" py={1} px={2}>
                                Leg Index
                              </Th>
                            </Tr>
                          </Thead>
                          <Tbody>
                            {enumerator.openLegs.map(
                              (leg: any, legIndex: number) => (
                                <Tr key={legIndex}>
                                  <Td
                                    fontSize="xs"
                                    py={1}
                                    px={2}
                                    fontFamily="mono"
                                  >
                                    {leg.instance_id}
                                  </Td>
                                  <Td
                                    fontSize="xs"
                                    py={1}
                                    px={2}
                                    fontFamily="mono"
                                  >
                                    {leg.leg_index}
                                  </Td>
                                </Tr>
                              )
                            )}
                          </Tbody>
                        </Table>
                      </Box>
                    </VStack>
                  )}

                  {/* Always show polynomial results if they exist, regardless of task state */}
                  {enumerator.polynomial && (
                    <VStack align="stretch" spacing={1}>
                      {/* Display the polynomial results */}
                      <VStack align="stretch" spacing={1}>
                        <Text fontSize="sm" fontWeight="medium">
                          Stabilizer Weight Enumerator Polynomial
                          {enumerator.polynomial.includes("\n") && (
                            <Text
                              as="span"
                              color="gray.500"
                              fontWeight="normal"
                            >
                              {" "}
                              ({enumerator.polynomial.split("\n").length}{" "}
                              elements)
                            </Text>
                          )}
                        </Text>
                        <Box
                          p={1}
                          borderWidth={0}
                          borderRadius="md"
                          bg="gray.50"
                          maxH="200px"
                          overflowY="auto"
                        >
                          {enumerator.polynomial.includes("\n") ? (
                            // Open legs format: each line is "PauliString: coefficient"
                            <VStack align="stretch" spacing={0}>
                              {enumerator.polynomial
                                .split("\n")
                                .map((line: string, lineIndex: number) => (
                                  <Text
                                    key={lineIndex}
                                    fontFamily="mono"
                                    fontSize="xs"
                                  >
                                    {line}
                                  </Text>
                                ))}
                            </VStack>
                          ) : (
                            // Regular polynomial format
                            <Text fontFamily="mono" fontSize="xs">
                              {enumerator.polynomial}
                            </Text>
                          )}
                        </Box>

                        {enumerator.normalizerPolynomial && (
                          <>
                            <Text fontSize="sm" fontWeight="medium">
                              Normalizer Weight Enumerator Polynomial
                              {enumerator.normalizerPolynomial.includes(
                                "\n"
                              ) && (
                                <Text
                                  as="span"
                                  color="gray.500"
                                  fontWeight="normal"
                                >
                                  {" "}
                                  (
                                  {
                                    enumerator.normalizerPolynomial.split("\n")
                                      .length
                                  }{" "}
                                  elements)
                                </Text>
                              )}
                            </Text>
                            <Box
                              p={1}
                              borderWidth={0}
                              borderRadius="md"
                              bg="gray.50"
                              maxH="200px"
                              overflowY="auto"
                            >
                              <Text fontFamily="mono" fontSize="xs">
                                {enumerator.normalizerPolynomial}
                              </Text>
                            </Box>
                          </>
                        )}
                      </VStack>
                    </VStack>
                  )}

                  {/* Show task details only when there are no polynomial results */}
                  {!enumerator.polynomial && (
                    <TaskDetailsDisplay
                      task={task}
                      taskId={taskId}
                      iterationStatus={taskIterationStatus}
                      waitingForTaskUpdate={isWaitingForUpdate}
                      taskUpdatesChannel={taskChannel}
                      onCancelTask={onCancelTask}
                      onViewLogs={onViewLogs}
                    />
                  )}
                </VStack>
              </AccordionPanel>
            </AccordionItem>
          );
        })}
      </Accordion>
    </VStack>
  );
};

export default WeightEnumerators;
