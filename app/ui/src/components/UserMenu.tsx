import React, { useState } from "react";
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  HStack,
  Avatar,
  useColorModeValue,
  Icon,
  Tooltip
} from "@chakra-ui/react";
import { FiUser, FiAlertCircle, FiPieChart } from "react-icons/fi";
import { User } from "@supabase/supabase-js";
import { userContextSupabase } from "../supabaseClient";
import { QuotasModal } from "./QuotasModal";

interface UserMenuProps {
  user?: User | null;
  onSignIn?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onSignIn }) => {
  const [isQuotasModalOpen, setIsQuotasModalOpen] = useState(false);
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  if (!user) {
    return (
      <Menu>
        <Tooltip
          label={
            !userContextSupabase
              ? "User Context is unavailable, no Supabase instance is setup"
              : "Not signed in"
          }
          placement="bottom"
        >
          <MenuButton
            as={HStack}
            spacing={2}
            px={2}
            py={2}
            rounded="md"
            cursor="pointer"
            alignItems="center"
            _hover={{ bg: useColorModeValue("gray.100", "gray.700") }}
            onClick={onSignIn}
            border="none"
            bg="transparent"
          >
            <Icon as={FiUser} boxSize={5} />
            {!userContextSupabase && (
              <Icon as={FiAlertCircle} color="red.500" boxSize={4} />
            )}
          </MenuButton>
        </Tooltip>
      </Menu>
    );
  }

  const handleSignOut = async () => {
    console.log("Signing out...");
    if (!userContextSupabase) {
      return;
    }
    userContextSupabase.auth
      .signOut()
      .then(() => {
        userContextSupabase!.auth
          .getUser()
          .then((user) => {
            console.log("Signed out..." + user);
          })
          .catch((error) => {
            console.error("Error getting user:", error);
          });
      })
      .catch((error) => {
        console.error("Error signing out:", error);
      });
  };

  return (
    <>
      <Menu>
        <Tooltip label={user.email} placement="bottom">
          <MenuButton
            as={HStack}
            spacing={2}
            px={2}
            py={2}
            rounded="md"
            cursor="pointer"
            alignItems="center"
            _hover={{ bg: useColorModeValue("gray.100", "gray.700") }}
            border="none"
            bg="transparent"
          >
            <Avatar size="sm" name={user.email || undefined} />
          </MenuButton>
        </Tooltip>
        <MenuList bg={bgColor} borderColor={borderColor}>
          <MenuItem
            onClick={() => setIsQuotasModalOpen(true)}
            icon={<Icon as={FiPieChart} />}
          >
            My quotas
          </MenuItem>
          <MenuItem onClick={() => handleSignOut()}>Sign Out</MenuItem>
        </MenuList>
      </Menu>

      <QuotasModal
        isOpen={isQuotasModalOpen}
        onClose={() => setIsQuotasModalOpen(false)}
      />
    </>
  );
};
