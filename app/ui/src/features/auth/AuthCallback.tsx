import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { userContextSupabase } from "../../config/supabaseClient";
import { Box, VStack, Text, Spinner, useToast } from "@chakra-ui/react";

export default function AuthCallback() {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    const handleAuthCallback = async () => {
      if (!userContextSupabase) {
        setError("No supabase client available");
        setIsProcessing(false);
        return;
      }

      try {
        // Get the session from the URL hash/fragment
        const { data, error } = await userContextSupabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (data.session) {
          // Successfully authenticated
          toast({
            title: "Successfully signed in",
            status: "success",
            duration: 3000,
            isClosable: true
          });

          // Get the original URL from sessionStorage
          const redirectUrl = sessionStorage.getItem("authRedirectUrl");

          if (redirectUrl) {
            // Clear the stored URL
            sessionStorage.removeItem("authRedirectUrl");

            // Navigate back to the original URL
            window.location.href = redirectUrl;
          } else {
            // Fallback to home page
            navigate("/");
          }
        } else {
          setError("No session found after authentication");
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setIsProcessing(false);

        toast({
          title: "Authentication failed",
          description:
            err instanceof Error
              ? err.message
              : "An error occurred during sign in",
          status: "error",
          duration: 5000,
          isClosable: true
        });
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  if (error) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        p={8}
      >
        <VStack spacing={4}>
          <Text fontSize="xl" color="red.500">
            Authentication Error
          </Text>
          <Text color="gray.600" textAlign="center">
            {error}
          </Text>
          <Text
            color="blue.500"
            cursor="pointer"
            onClick={() => navigate("/")}
            _hover={{ textDecoration: "underline" }}
          >
            Return to home
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      p={8}
    >
      <VStack spacing={4}>
        <Spinner size="xl" />
        <Text fontSize="lg">
          {isProcessing ? "Processing authentication..." : "Redirecting..."}
        </Text>
      </VStack>
    </Box>
  );
}
