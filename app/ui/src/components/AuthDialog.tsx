// Example using useEffect in a component or context
import React, { useEffect, useState } from "react";
import { userContextSupabase } from "../supabaseClient.ts";
import { Session, User } from "@supabase/supabase-js";
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  useToast,
  // Divider,
  FormErrorMessage,
  Image,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Box
} from "@chakra-ui/react";
import { checkSupabaseStatus } from "../lib/errors.ts";

interface AuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectionError?: string;
}

export default function AuthDialog({
  isOpen,
  onClose,
  connectionError
}: AuthDialogProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [retryingConnection, setRetryingConnection] = useState(false);

  useEffect(() => {
    if (!userContextSupabase) {
      setLoading(false);
      return;
    }
    // Get initial session
    userContextSupabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        onClose();
      }
    });

    // Listen for auth changes
    const {
      data: { subscription }
    } = userContextSupabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setCurrentUser(session?.user ?? null);
        if (session?.user) {
          onClose();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleEmailPasswordAuth = async (e: React.FormEvent) => {
    if (!userContextSupabase) {
      setError("No supabase client available");
      return;
    }
    e.preventDefault();
    setError("");

    if (connectionError) {
      setError("Cannot sign in due to backend connection issues");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const { error } = await userContextSupabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              emailRedirectTo: `${window.location}`
            }
          }
        });
        if (error) throw error;

        toast({
          title: "Account created",
          description: "Please check your email for verification",
          status: "success",
          duration: 3000,
          isClosable: true
        });
      } else {
        const { error } = await userContextSupabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;

        toast({
          title: "Signed in",
          description: "You have been signed in successfully",
          status: "success",
          duration: 3000,
          isClosable: true
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
        toast({
          title: "Error",
          description: err.message,
          status: "error",
          duration: 5000,
          isClosable: true
        });
      } else {
        setError("An unknown error occurred");
        toast({
          title: "Error",
          description: "An unknown error occurred",
          status: "error",
          duration: 5000,
          isClosable: true
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // const handleGoogleSignIn = async () => {
  //   try {
  //     const { error } = await userContextSupabase.auth.signInWithOAuth({
  //       provider: "google",
  //       options: {
  //         redirectTo: window.location.origin,
  //       },
  //     });

  //     if (error) throw error;

  //     toast({
  //       title: "Redirecting to Google",
  //       description: "Please complete the sign in with Google",
  //       status: "info",
  //       duration: 3000,
  //       isClosable: true,
  //     });
  //   } catch (err: unknown) {
  //     if (err instanceof Error) {
  //       setError(err.message);
  //       toast({
  //         title: "Error",
  //         description: err.message,
  //         status: "error",
  //         duration: 5000,
  //         isClosable: true,
  //       });
  //     } else {
  //       setError("An unknown error occurred");
  //       toast({
  //         title: "Error",
  //         description: "An unknown error occurred",
  //         status: "error",
  //         duration: 5000,
  //         isClosable: true,
  //       });
  //     }
  //   }
  // };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage("");
    try {
      if (!userContextSupabase) {
        throw new Error("No supabase client available");
      }
      const { error } = await userContextSupabase.auth.resetPasswordForEmail(
        resetEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`
        }
      );
      if (error) throw error;

      setResetMessage("Password reset email sent! Check your inbox.");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setResetMessage(err.message);
      } else {
        setResetMessage("An unknown error occurred");
      }
    }
  };

  const handleSignOut = async () => {
    if (!userContextSupabase) {
      return;
    }
    try {
      const { error } = await userContextSupabase.auth.signOut();
      if (error) throw error;
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast({
          title: "Error signing out",
          description: err.message,
          status: "error",
          duration: 5000,
          isClosable: true
        });
      } else {
        toast({
          title: "Error signing out",
          description: "An unknown error occurred",
          status: "error",
          duration: 5000,
          isClosable: true
        });
      }
    }
  };

  const handleRetryConnection = async () => {
    if (!userContextSupabase) {
      return;
    }
    setRetryingConnection(true);
    try {
      const status = await checkSupabaseStatus(userContextSupabase, 2);
      if (status.isHealthy) {
        // Connection restored
        toast({
          title: "Connection Restored",
          description: "Backend connection is now available",
          status: "success",
          duration: 3000,
          isClosable: true
        });
        // Force reload the page to reset all connections
        window.location.reload();
      } else {
        // Still having issues
        toast({
          title: "Connection Failed",
          description: status.message,
          status: "error",
          duration: 5000,
          isClosable: true
        });
      }
    } catch {
      toast({
        title: "Connection Failed",
        description: "Could not connect to backend service",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    } finally {
      setRetryingConnection(false);
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
          {currentUser
            ? "Account"
            : isSignUp
              ? "Create Account"
              : showReset
                ? "Reset Password"
                : "Sign In"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {connectionError && (
            <Alert
              status="error"
              mb={4}
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              textAlign="center"
            >
              <AlertIcon />
              <AlertTitle mb={2}>Connection Error</AlertTitle>
              <AlertDescription>
                <Box mb={3}>{connectionError}</Box>
                <Button
                  colorScheme="red"
                  size="sm"
                  onClick={handleRetryConnection}
                  isLoading={retryingConnection}
                >
                  Retry Connection
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {currentUser ? (
            <VStack spacing={4}>
              <Text>Welcome, {currentUser?.email || "User"}!</Text>
              <Button onClick={handleSignOut} colorScheme="red" width="full">
                Sign Out
              </Button>
            </VStack>
          ) : showReset ? (
            <VStack spacing={6} as="form" onSubmit={handlePasswordReset}>
              <Image
                src="/planqtn_logo.svg"
                alt="PlanqTN Logo"
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
                    if (e.key === "Enter") {
                      handlePasswordReset(e);
                    }
                  }}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </FormControl>
              {resetMessage && (
                <Text
                  color={
                    resetMessage.includes("sent") ? "green.500" : "red.500"
                  }
                >
                  {resetMessage}
                </Text>
              )}
              <Button type="submit" colorScheme="blue" width="full">
                Send Password Reset Email
              </Button>
              <Button variant="link" onClick={() => setShowReset(false)}>
                Back to Sign In
              </Button>
            </VStack>
          ) : (
            <VStack
              spacing={6}
              as="form"
              id="auth-form"
              onSubmit={handleEmailPasswordAuth}
            >
              <Image
                src="/planqtn_logo.svg"
                alt="PlanqTN Logo"
                maxW="200px"
                mx="auto"
                mb={4}
              />
              <Text fontSize="xl" fontWeight="bold">
                {isSignUp ? "Create Account" : "Sign In"}
              </Text>

              <FormControl isInvalid={!!error}>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      handleEmailPasswordAuth(e);
                    }
                  }}
                  required
                  isDisabled={!!connectionError}
                />
              </FormControl>

              <FormControl isInvalid={!!error}>
                <FormLabel>Password</FormLabel>
                <Input
                  type="password"
                  value={password}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      handleEmailPasswordAuth(e);
                    }
                  }}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  isDisabled={!!connectionError}
                />
                {error && <FormErrorMessage>{error}</FormErrorMessage>}
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                width="full"
                isLoading={isLoading}
                isDisabled={!!connectionError}
              >
                {isSignUp ? "Sign Up" : "Sign In"}
              </Button>

              <Button variant="link" onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp
                  ? "Already have an account? Sign In"
                  : "Don't have an account? Sign Up"}
              </Button>

              <Button
                variant="link"
                onClick={() => setShowReset(true)}
                colorScheme="blue"
              >
                Forgot password?
              </Button>

              {/* <Divider /> */}

              {/* <Button
                onClick={handleGoogleSignIn}
                colorScheme="red"
                width="full"
              >
                {isSignUp ? "Sign up with Google" : "Sign in with Google"}
              </Button> */}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          {!showReset && !currentUser && (
            <Button
              colorScheme="blue"
              mr={3}
              onClick={handleEmailPasswordAuth}
              isLoading={isLoading}
              isDisabled={!!connectionError}
              form="auth-form"
              type="submit"
            >
              {isSignUp ? "Sign Up" : "Sign In"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {currentUser || showReset ? "Close" : "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
