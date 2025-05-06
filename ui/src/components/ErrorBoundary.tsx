import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Heading, Text, Button, VStack } from '@chakra-ui/react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <Box p={8} textAlign="center">
                    <VStack spacing={4}>
                        <Heading size="xl">Oops! Something went wrong</Heading>
                        <Text color="gray.600">
                            {this.state.error?.message || 'An unexpected error occurred'}
                        </Text>
                        <Text as="pre" color="gray.600">
                            {this.state.error?.stack?.split('\n').slice(2).join('\n')}
                        </Text>
                        <Button
                            colorScheme="blue"
                            onClick={() => {
                                window.history.replaceState(null, '', window.location.pathname + window.location.search)
                                window.location.reload()
                            }}
                        >
                            Reset state
                        </Button>
                    </VStack>
                </Box>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary; 