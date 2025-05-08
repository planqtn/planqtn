// Example using useEffect in a component or context
import React, { useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import {
    onAuthStateChanged,
    signOut,
    User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from 'firebase/auth';
import {
    Button,
    FormControl,
    FormLabel,
    Input,
    VStack,
    Text,
    useToast,
    Divider,
    FormErrorMessage,
    Image,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
} from '@chakra-ui/react';

interface AuthDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthDialog({ isOpen, onClose }: AuthDialogProps) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [error, setError] = useState('');
    const toast = useToast();
    const [showReset, setShowReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetMessage, setResetMessage] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
            setCurrentUser(user);
            setLoading(false);
            if (user) {
                onClose(); // Close the modal when user is authenticated
            }
        });

        return () => unsubscribe();
    }, [onClose]);

    const handleEmailPasswordAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (isSignUp) {
                await createUserWithEmailAndPassword(auth, email, password);
                toast({
                    title: "Account created",
                    description: "Your account has been created successfully",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                toast({
                    title: "Signed in",
                    description: "You have been signed in successfully",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                });
            }
        } catch (err: any) {
            setError(err.message);
            toast({
                title: "Error",
                description: err.message,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const handleGoogleSignIn = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            toast({
                title: "Signed in with Google",
                description: "You have been signed in successfully",
                status: "success",
                duration: 3000,
                isClosable: true,
            });
        } catch (err: any) {
            setError(err.message);
            toast({
                title: "Error",
                description: err.message,
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetMessage('');
        try {
            await sendPasswordResetEmail(auth, resetEmail);
            setResetMessage('Password reset email sent! Check your inbox.');
        } catch (err: any) {
            setResetMessage(err.message);
        }
    };

    if (loading) {
        return null;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} isCentered>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader textAlign="center">
                    {currentUser ? 'Account' : (isSignUp ? 'Create Account' : showReset ? 'Reset Password' : 'Sign In')}
                </ModalHeader>
                <ModalCloseButton />
                <ModalBody pb={6}>
                    {currentUser ? (
                        <VStack spacing={4}>
                            <Text>Welcome, {currentUser?.email || 'User'}!</Text>
                            <Button onClick={() => signOut(auth)} colorScheme="red" width="full">
                                Sign Out
                            </Button>
                        </VStack>
                    ) : showReset ? (
                        <VStack spacing={6} as="form" onSubmit={handlePasswordReset}>
                            <Image
                                src="/planqtn_logo.svg"
                                alt="PlanQTN Logo"
                                maxW="200px"
                                mx="auto"
                                mb={4}
                            />
                            <FormControl>
                                <FormLabel>Email</FormLabel>
                                <Input
                                    type="email"
                                    value={resetEmail}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Enter') {
                                            handlePasswordReset(e);
                                        }
                                    }}
                                    onChange={(e) => setResetEmail(e.target.value)}
                                    required
                                />
                            </FormControl>
                            {resetMessage && <Text color={resetMessage.includes('sent') ? 'green.500' : 'red.500'}>{resetMessage}</Text>}
                            <Button type="submit" colorScheme="blue" width="full">
                                Send Password Reset Email
                            </Button>
                            <Button variant="link" onClick={() => setShowReset(false)}>
                                Back to Sign In
                            </Button>
                        </VStack>
                    ) : (
                        <VStack spacing={6} as="form" onSubmit={handleEmailPasswordAuth}>
                            <Image
                                src="/planqtn_logo.svg"
                                alt="PlanQTN Logo"
                                maxW="200px"
                                mx="auto"
                                mb={4}
                            />
                            <Text fontSize="xl" fontWeight="bold">
                                {isSignUp ? 'Create Account' : 'Sign In'}
                            </Text>

                            <FormControl isInvalid={!!error}>
                                <FormLabel>Email</FormLabel>
                                <Input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Enter') {
                                            handleEmailPasswordAuth(e);
                                        }
                                    }}
                                    required
                                />
                            </FormControl>

                            <FormControl isInvalid={!!error}>
                                <FormLabel>Password</FormLabel>
                                <Input
                                    type="password"
                                    value={password}
                                    onKeyDown={(e) => {
                                        e.stopPropagation();
                                        if (e.key === 'Enter') {
                                            handleEmailPasswordAuth(e);
                                        }
                                    }}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                {error && <FormErrorMessage>{error}</FormErrorMessage>}
                            </FormControl>

                            <Button type="submit" colorScheme="blue" width="full">
                                {isSignUp ? 'Sign Up' : 'Sign In'}
                            </Button>

                            <Button
                                variant="link"
                                onClick={() => setIsSignUp(!isSignUp)}
                            >
                                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                            </Button>

                            <Button
                                variant="link"
                                onClick={() => setShowReset(true)}
                                colorScheme="blue"
                            >
                                Forgot password?
                            </Button>

                            <Divider />

                            <Button
                                onClick={handleGoogleSignIn}
                                colorScheme="red"
                                width="full"
                            >
                                {isSignUp ? 'Sign up with Google' : "Sign in with Google"}
                            </Button>
                        </VStack>
                    )}
                </ModalBody>
            </ModalContent>
        </Modal>
    );
}
