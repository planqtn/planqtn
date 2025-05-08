import React from 'react';
import {
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    HStack,
    Text,
    Avatar,
    useColorModeValue,
    Icon,
    VStack
} from '@chakra-ui/react';
import { User } from 'firebase/auth';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { FiUser } from 'react-icons/fi';

interface UserMenuProps {
    user?: User | null;
    onSignIn?: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ user, onSignIn }) => {
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    if (!user) {
        return (
            <Menu>
                <MenuButton
                    as={HStack}
                    spacing={2}
                    px={3}
                    py={2}
                    rounded="md"
                    cursor="pointer"
                    alignItems="center"
                    _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
                    onClick={onSignIn}
                >
                    <VStack spacing={2}>
                        <Icon as={FiUser} boxSize={6} />
                        <Text fontSize="sm" lineHeight={1} display="flex" alignItems="center">Not signed in</Text>
                    </VStack>
                </MenuButton>
            </Menu>
        );
    }

    return (
        <Menu>
            <MenuButton
                as={HStack}
                spacing={2}
                px={3}
                py={2}
                rounded="md"
                cursor="pointer"
                alignItems="center"
                _hover={{ bg: useColorModeValue('gray.100', 'gray.700') }}
            >
                <VStack spacing={2}>
                    <Avatar size="sm" name={user.email || undefined} />
                    <Text fontSize="sm" lineHeight={1} display="flex" alignItems="center">{user.email}</Text>
                </VStack>
            </MenuButton>
            <MenuList bg={bgColor} borderColor={borderColor}>
                <MenuItem onClick={() => signOut(auth)}>Sign Out</MenuItem>
            </MenuList>
        </Menu>
    );
}; 