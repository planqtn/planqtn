import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { User, PieChart, AlertCircle } from "lucide-react";
import { Box, Icon } from "@chakra-ui/react";
import { userContextSupabase } from "../../config/supabaseClient";
import { useUserStore } from "@/stores/userStore";
import { useCanvasStore } from "@/stores/canvasStateStore";

interface UserMenuProps {
  onSignIn?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onSignIn }) => {
  const { currentUser, setCurrentUser } = useUserStore();
  const { openQuotasDialog } = useCanvasStore();

  if (!currentUser) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Box
            p={2}
            cursor="pointer"
            _hover={{ bg: "gray.100" }}
            borderRadius="full"
            transition="all 0.2s ease-in-out"
            onClick={onSignIn}
          >
            <Icon as={User} boxSize={5} />
            {!userContextSupabase && (
              <Icon as={AlertCircle} color="red.500" boxSize={4} />
            )}
          </Box>
        </TooltipTrigger>
        <TooltipContent className="high-z">
          {!userContextSupabase
            ? "User Context is unavailable, no Supabase instance is setup"
            : "Not signed in"}
        </TooltipContent>
      </Tooltip>
    );
  }

  const handleSignOut = async () => {
    console.log("Signing out...");
    if (!userContextSupabase) {
      return;
    }
    try {
      await userContextSupabase.auth.signOut();
      setCurrentUser(null);
      console.log("Signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Box
                p={2}
                cursor="pointer"
                _hover={{ bg: "gray.100" }}
                borderRadius="full"
                transition="all 0.2s ease-in-out"
              >
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold">
                  {currentUser.email?.charAt(0).toUpperCase() || "U"}
                </div>
              </Box>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent className="high-z">
            {currentUser.email}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent className="high-z">
          <DropdownMenuItem onClick={() => openQuotasDialog()}>
            <PieChart className="mr-2 h-4 w-4" />
            My quotas
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>Sign Out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
