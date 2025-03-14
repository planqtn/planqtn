import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    Button,
    FormControl,
    FormLabel,
    Input,
    VStack,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
} from '@chakra-ui/react';
import { useState, useRef } from 'react';

interface DynamicLegoDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (parameters: Record<string, any>) => void;
    legoId: string;
    parameters: Record<string, any>;
}

export const DynamicLegoDialog: React.FC<DynamicLegoDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    legoId,
    parameters,
}) => {
    const [values, setValues] = useState<Record<string, any>>(parameters);
    const firstInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(values);
        onClose();
    };

    const renderParameterInput = (key: string, value: any, isFirst: boolean) => {
        if (typeof value === 'number') {
            return (
                <FormControl key={key}>
                    <FormLabel>{key}</FormLabel>
                    <NumberInput
                        value={values[key]}
                        min={1}
                        onChange={(_, value) => setValues({ ...values, [key]: value })}
                    >
                        <NumberInputField ref={isFirst ? firstInputRef : undefined} />
                        <NumberInputStepper>
                            <NumberIncrementStepper />
                            <NumberDecrementStepper />
                        </NumberInputStepper>
                    </NumberInput>
                </FormControl>
            );
        }
        return (
            <FormControl key={key}>
                <FormLabel>{key}</FormLabel>
                <Input
                    value={values[key]}
                    onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                    ref={isFirst ? firstInputRef : undefined}
                />
            </FormControl>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} initialFocusRef={firstInputRef}>
            <ModalOverlay />
            <ModalContent>
                <form onSubmit={handleSubmit}>
                    <ModalHeader>Configure {legoId}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={4}>
                            {Object.entries(parameters).map(([key, value], index) =>
                                renderParameterInput(key, value, index === 0)
                            )}
                        </VStack>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="ghost" mr={3} onClick={onClose}>
                            Cancel
                        </Button>
                        <Button colorScheme="blue" type="submit">
                            Create
                        </Button>
                    </ModalFooter>
                </form>
            </ModalContent>
        </Modal>
    );
}; 