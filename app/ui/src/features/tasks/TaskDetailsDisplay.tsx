import {
  Box,
  VStack,
  Heading,
  Text,
  HStack,
  IconButton,
  Spinner,
  Icon,
  Button
} from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { Task, TaskUpdateIterationStatus } from "../../lib/types.ts";
import TaskStateLabel from "./TaskStateLabel.tsx";
import ProgressBars from "./ProgressBars.tsx";
import { formatDuration, intervalToDuration } from "date-fns";
import { RealtimeChannel } from "@supabase/supabase-js";
import { FaFileAlt } from "react-icons/fa";

interface TaskDetailsDisplayProps {
  task: Task | null;
  taskId: string | undefined;
  iterationStatus: Array<TaskUpdateIterationStatus>;
  waitingForTaskUpdate: boolean;
  taskUpdatesChannel: RealtimeChannel | null;
  onCancelTask: (taskId: string) => void;
  onViewLogs: (taskId: string) => void;
}

// Helper to format seconds using date-fns
function formatSecondsToDuration(seconds: number) {
  const duration = intervalToDuration({
    start: 0,
    end: Math.round(seconds * 1000)
  });

  // Use a more explicit format that always includes seconds
  return (
    formatDuration(duration, {
      format: ["hours", "minutes", "seconds"],
      zero: true,
      delimiter: " "
    }) || `${seconds.toFixed(2)}s`
  ); // Fallback to simple format
}

const TaskDetailsDisplay: React.FC<TaskDetailsDisplayProps> = ({
  task,
  taskId,
  iterationStatus,
  waitingForTaskUpdate,
  taskUpdatesChannel,
  onCancelTask,
  onViewLogs
}) => {
  return (
    <Box p={4} borderWidth={1} borderRadius="lg">
      <VStack spacing={2} align="stretch">
        <Heading size="sm">Task Details</Heading>
        <HStack>
          <Text>Task ID: {taskId}</Text>
          {task && (task.state === 0 || task.state === 1) && (
            <IconButton
              aria-label="Cancel task"
              icon={<CloseIcon />}
              size="xs"
              colorScheme="red"
              onClick={() => {
                if (taskId) {
                  onCancelTask(taskId);
                }
              }}
            />
          )}
        </HStack>
        {task && (
          <VStack align="left" spacing={2}>
            <HStack>
              <Text>Task state:</Text>
              <TaskStateLabel state={task.state} />
              {taskUpdatesChannel && (task.state === 0 || task.state === 1) && (
                <Spinner size="sm" color="blue.500" />
              )}
            </HStack>
            <Text>Job type: {task.job_type}</Text>
            {task.state === 2 && task.result && (
              <Text>
                Execution time:{" "}
                {(() => {
                  const time = JSON.parse(task.result!).time;
                  return formatSecondsToDuration(time);
                })()}
              </Text>
            )}
          </VStack>
        )}

        {task && (task.state === 0 || task.state === 1) && (
          <ProgressBars
            iterationStatus={iterationStatus}
            waiting={waitingForTaskUpdate}
          />
        )}
        {task &&
          task.state === 2 &&
          task.result &&
          task.job_type === "weightenumerator" && (
            <VStack align="stretch" spacing={2}>
              <Heading size="sm">
                Stabilizer Weight Enumerator Polynomial
              </Heading>
              <Box p={3} borderWidth={1} borderRadius="md" bg="gray.50">
                <Text fontFamily="mono">
                  {(() => {
                    const parsedResult = JSON.parse(task.result!);
                    return (
                      parsedResult.stabilizer_polynomial ||
                      "No polynomial available"
                    );
                  })()}
                </Text>
              </Box>
              <Heading size="sm">
                Normalizer Weight Enumerator Polynomial
              </Heading>
              <Box p={3} borderWidth={1} borderRadius="md" bg="gray.50">
                <Text fontFamily="mono">
                  {JSON.parse(task.result!).normalizer_polynomial ||
                    "No polynomial available"}
                </Text>
              </Box>
            </VStack>
          )}
        {task && task.state === 3 && (
          <VStack align="stretch" spacing={3}>
            <Text>Task failed: {task.result}</Text>
            <Button
              leftIcon={<Icon as={FaFileAlt} />}
              size="sm"
              colorScheme="blue"
              onClick={() => onViewLogs(task.uuid)}
            >
              View Logs
            </Button>
          </VStack>
        )}
      </VStack>
    </Box>
  );
};

export default TaskDetailsDisplay;
