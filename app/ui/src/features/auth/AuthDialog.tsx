// Example using useEffect in a component or context
import React, { useEffect, useState } from "react";
import { userContextSupabase } from "../../config/supabaseClient.ts";
import { Session, User } from "@supabase/supabase-js";
import {
  Button,
  VStack,
  Text,
  useToast,
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
  Box,
  Link,
  Icon,
  useColorModeValue
} from "@chakra-ui/react";
import { checkSupabaseStatus } from "../../lib/errors.ts";
import { FiExternalLink } from "react-icons/fi";
import { FcGoogle } from "react-icons/fc";
import { FaGithub } from "react-icons/fa";
import { privacyPolicyUrl, termsOfServiceUrl } from "../../config/config.ts";

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
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
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

  const handleGoogleSignIn = async () => {
    if (!userContextSupabase) {
      setError("No supabase client available");
      return;
    }

    if (connectionError) {
      setError("Cannot sign in due to backend connection issues");
      return;
    }

    setIsLoading(true);
    try {
      // Store the current URL to redirect back after auth
      const currentUrl = window.location.href;
      sessionStorage.setItem("authRedirectUrl", currentUrl);

      const { error } = await userContextSupabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth-callback`
        }
      });

      if (error) throw error;

      toast({
        title: "Redirecting to Google",
        description:
          "If this is your first time, complete the sign in with Google",
        status: "info",
        duration: 3000,
        isClosable: true
      });
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

  const handleGitHubSignIn = async () => {
    if (!userContextSupabase) {
      setError("No supabase client available");
      return;
    }

    if (connectionError) {
      setError("Cannot sign in due to backend connection issues");
      return;
    }

    setIsLoading(true);
    try {
      // Store the current URL to redirect back after auth
      const currentUrl = window.location.href;
      sessionStorage.setItem("authRedirectUrl", currentUrl);

      const { error } = await userContextSupabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth-callback`
        }
      });

      if (error) throw error;

      toast({
        title: "Redirecting to GitHub",
        description:
          "If this is your first time, complete the sign in with GitHub",
        status: "info",
        duration: 3000,
        isClosable: true
      });
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
          {currentUser ? "Account" : "Sign In"}
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
          ) : (
            <VStack spacing={6}>
              <Image
                src="/planqtn_logo.png"
                alt="PlanqTN Logo"
                maxW="200px"
                mx="auto"
                mb={4}
              />
              <Text fontSize="xl" fontWeight="bold" textAlign="center">
                Sign In to PlanqTN
              </Text>

              <Text textAlign="center" color="gray.600">
                Use your Google or GitHub account to sign in and access all
                features
              </Text>

              {error && (
                <Text color="red.500" textAlign="center" fontSize="sm">
                  {error}
                </Text>
              )}

              <VStack spacing={3} width="full">
                <Button
                  onClick={handleGoogleSignIn}
                  colorScheme="gray"
                  width="full"
                  size="lg"
                  isLoading={isLoading}
                  isDisabled={!!connectionError}
                  leftIcon={<Icon as={FcGoogle} />}
                >
                  Sign in with Google
                </Button>

                <Button
                  onClick={handleGitHubSignIn}
                  colorScheme="gray"
                  width="full"
                  size="lg"
                  isLoading={isLoading}
                  isDisabled={!!connectionError}
                  leftIcon={<Icon as={FaGithub} />}
                >
                  Sign in with GitHub
                </Button>
              </VStack>

              <Text fontSize="sm" textAlign="center" color="gray.600">
                By signing in, you agree to our{" "}
                <Link
                  href={termsOfServiceUrl}
                  isExternal
                  color={useColorModeValue("blue.500", "blue.300")}
                  display="inline-flex"
                  alignItems="center"
                  gap={1}
                >
                  Terms of Service
                  <Icon as={FiExternalLink} boxSize={3} />
                </Link>{" "}
                and{" "}
                <Link
                  href={privacyPolicyUrl}
                  isExternal
                  color={useColorModeValue("blue.500", "blue.300")}
                  display="inline-flex"
                  alignItems="center"
                  gap={1}
                >
                  Privacy Policy
                  <Icon as={FiExternalLink} boxSize={3} />
                </Link>
              </Text>
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            {currentUser ? "Close" : "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
