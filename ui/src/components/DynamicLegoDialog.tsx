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
import { useState } from 'react';

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(values);
        onClose();
    };

    const renderParameterInput = (key: string, value: any) => {
        if (typeof value === 'number') {
            return (
                <FormControl key={key}>
                    <FormLabel>{key}</FormLabel>
                    <NumberInput
                        value={values[key]}
                        min={1}
                        onChange={(_, value) => setValues({ ...values, [key]: value })}
                    >
                        <NumberInputField />
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
                />
            </FormControl>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent>
                <form onSubmit={handleSubmit}>
                    <ModalHeader>Configure {legoId}</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody>
                        <VStack spacing={4}>
                            {Object.entries(parameters).map(([key, value]) =>
                                renderParameterInput(key, value)
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