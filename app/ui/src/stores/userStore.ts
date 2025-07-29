import { create } from "zustand";
import { User } from "@supabase/supabase-js";

interface UserSlice {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isUserLoggedIn: boolean;
}

export const useUserStore = create<UserSlice>((set, get) => ({
  currentUser: null,
  setCurrentUser: (user: User | null) =>
    set(() => ({
      currentUser: user,
      isUserLoggedIn: !!user
    })),
  get isUserLoggedIn() {
    return !!get().currentUser;
  }
}));
