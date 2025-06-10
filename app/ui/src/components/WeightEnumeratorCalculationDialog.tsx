import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Input,
  Text,
  VStack,
  Tooltip,
  HStack,
  Checkbox,
  Box
} from "@chakra-ui/react";
import { useState, useMemo } from "react";
import { QuestionOutlineIcon } from "@chakra-ui/icons";
import { TensorNetworkLeg } from "../lib/TensorNetwork";

interface WeightEnumeratorCalculationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    truncateLength: number | null,
    openLegs: TensorNetworkLeg[]
  ) => void;
  externalLegs: TensorNetworkLeg[];
  danglingLegs: TensorNetworkLeg[];
}

const WeightEnumeratorCalculationDialog: React.FC<
  WeightEnumeratorCalculationDialogProps
> = ({ open, onClose, onSubmit, externalLegs, danglingLegs }) => {
  const [truncateLength, setTruncateLength] = useState<string>("");
  // Use string keys for easy lookup: "instanceId-legIndex"
  const externalKeys = useMemo(
    () => externalLegs.map((l) => `${l.instanceId}-${l.legIndex}`),
    [externalLegs]
  );
  const danglingKeys = useMemo(
    () => danglingLegs.map((l) => `${l.instanceId}-${l.legIndex}`),
    [danglingLegs]
  );

  // By default, external legs selected, dangling legs not
  const [selectedExternal, setSelectedExternal] = useState<Set<string>>(
    new Set(externalKeys)
  );
  const [selectedDangling, setSelectedDangling] = useState<Set<string>>(
    new Set()
  );

  // Update selection if legs change
  // (e.g. dialog is opened for a different network)

  useMemo(() => {
    setSelectedExternal(new Set(externalKeys));
  }, [externalKeys.join(",")]);

  useMemo(() => {
    setSelectedDangling(new Set());
  }, [danglingKeys.join(",")]);

  // Three-state logic for parent checkboxes
  const getParentState = (all: string[], selected: Set<string>) => {
    if (selected.size === 0) return false;
    if (selected.size === all.length) return true;
    return "indeterminate";
  };

  const handleParentToggle = (
    all: string[],
    selected: Set<string>,
    setSelected: (s: Set<string>) => void
  ) => {
    if (selected.size === all.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(all));
    }
  };

  const handleChildToggle = (
    key: string,
    selected: Set<string>,
    setSelected: (s: Set<string>) => void
  ) => {
    const newSet = new Set(selected);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelected(newSet);
  };

  // Collect selected legs
  const selectedLegs: TensorNetworkLeg[] = [
    ...externalLegs.filter((l) =>
      selectedExternal.has(`${l.instanceId}-${l.legIndex}`)
    ),
    ...danglingLegs.filter((l) =>
      selectedDangling.has(`${l.instanceId}-${l.legIndex}`)
    )
  ];

  const subtitle =
    selectedLegs.length === 0
      ? "Scalar weight enumerator"
      : `Tensor weight enumerator with ${selectedLegs.length} open leg${selectedLegs.length > 1 ? "s" : ""}`;

  const handleSubmit = () => {
    if (truncateLength === "") {
      onSubmit(null, selectedLegs);
    } else {
      const value = parseInt(truncateLength);
      if (isNaN(value) || value < 1) {
        return;
      }
      onSubmit(value, selectedLegs);
    }
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={onClose}>
      <ModalContent maxHeight="90vh" overflowY="auto">
        <ModalHeader>Weight Enumerator Calculation</ModalHeader>
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text fontSize="md" fontWeight="semibold">
              {subtitle}
            </Text>
            <HStack>
              <Text>Truncation level (leave empty for no truncation):</Text>
              <Tooltip
                label="Truncation level limits the maximum weight in the weight enumerator, making the calculation faster. Note: Normalizer calculation is not available yet when truncation is used."
                fontSize="sm"
              >
                <QuestionOutlineIcon ml={2} />
              </Tooltip>
            </HStack>
            <Input
              value={truncateLength}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
              onChange={(e) => setTruncateLength(e.target.value)}
              placeholder="Enter truncation level (≥ 1)"
              type="number"
              min={1}
            />
            <Box>
              <Text fontWeight="bold" mb={1}>
                External legs
              </Text>
              {externalLegs.length === 0 ? (
                <Text color="gray.500">No external connections</Text>
              ) : (
                <>
                  <Checkbox
                    isChecked={
                      getParentState(externalKeys, selectedExternal) === true
                    }
                    isIndeterminate={
                      getParentState(externalKeys, selectedExternal) ===
                      "indeterminate"
                    }
                    onChange={() =>
                      handleParentToggle(
                        externalKeys,
                        selectedExternal,
                        setSelectedExternal
                      )
                    }
                    mb={1}
                  >
                    Select all
                  </Checkbox>
                  <VStack
                    align="start"
                    spacing={1}
                    pl={4}
                    maxHeight="200px"
                    overflowY="auto"
                  >
                    {externalLegs.map((leg) => {
                      const key = `${leg.instanceId}-${leg.legIndex}`;
                      return (
                        <Checkbox
                          key={key}
                          isChecked={selectedExternal.has(key)}
                          onChange={() =>
                            handleChildToggle(
                              key,
                              selectedExternal,
                              setSelectedExternal
                            )
                          }
                        >
                          {leg.instanceId} - {leg.legIndex}
                        </Checkbox>
                      );
                    })}
                  </VStack>
                </>
              )}
            </Box>
            <Box mt={4}>
              <Text fontWeight="bold" mb={1}>
                Dangling legs
              </Text>
              {danglingLegs.length === 0 ? (
                <Text color="gray.500">No dangling legs</Text>
              ) : (
                <>
                  <Checkbox
                    isChecked={
                      getParentState(danglingKeys, selectedDangling) === true
                    }
                    isIndeterminate={
                      getParentState(danglingKeys, selectedDangling) ===
                      "indeterminate"
                    }
                    onChange={() =>
                      handleParentToggle(
                        danglingKeys,
                        selectedDangling,
                        setSelectedDangling
                      )
                    }
                    mb={1}
                  >
                    Select all
                  </Checkbox>
                  <VStack
                    align="start"
                    spacing={1}
                    pl={4}
                    maxHeight="200px"
                    overflowY="auto"
                  >
                    {danglingLegs.map((leg) => {
                      const key = `${leg.instanceId}-${leg.legIndex}`;
                      return (
                        <Checkbox
                          key={key}
                          isChecked={selectedDangling.has(key)}
                          onChange={() =>
                            handleChildToggle(
                              key,
                              selectedDangling,
                              setSelectedDangling
                            )
                          }
                        >
                          {leg.instanceId} - {leg.legIndex}
                        </Checkbox>
                      );
                    })}
                  </VStack>
                </>
              )}
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSubmit}>
            Calculate
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default WeightEnumeratorCalculationDialog;
