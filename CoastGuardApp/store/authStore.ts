import { create } from 'zustand';
import { router } from 'expo-router';
import { saveToken, getToken, deleteToken } from '@/utils/storage';

interface User {
    userID: string;
    userName: string;
    role: string;
}

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: User | null;
    isLoading: boolean;
    login: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
    register: (accessToken: string, refreshToken: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
    setTokens: (accessToken: string, refreshToken?: string) => Promise<void>; // New helper
    loadSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    isLoading: true,

    login: async (accessToken, refreshToken, user) => {
        await saveToken('access_token', accessToken);
        await saveToken('refresh_token', refreshToken);
        await saveToken('user_data', JSON.stringify(user));

        set({ accessToken, refreshToken, user });

        // Role-based routing
        if (user.role === 'analyst') {
            // router.replace('/(app)/analyst/dashboard');
        } else if (user.role === 'official') {
            router.replace('/(app)/official/dashboard');
        } else {
            router.replace('/(app)/citizen');
        }
    },

    register: async (accessToken, refreshToken, user) => {
        await saveToken('access_token', accessToken);
        await saveToken('refresh_token', refreshToken);
        await saveToken('user_data', JSON.stringify(user));

        set({ accessToken, refreshToken, user });

        // Role-based routing
        if (user.role === 'analyst') {
            // router.replace('/(app)/analyst/dashboard');
        } else if (user.role === 'official') {
            router.replace('/(app)/official/dashboard');
        } else {
            router.replace('/(app)/citizen');
        }
    },

    logout: async () => {
        await deleteToken('access_token');
        await deleteToken('refresh_token');
        await deleteToken('user_data');
        set({ accessToken: null, refreshToken: null, user: null });
        router.replace('/(auth)/login');
    },

    // Helper to update tokens without triggering a full login/redirect
    setTokens: async (newAccessToken, newRefreshToken) => {
        await saveToken('access_token', newAccessToken);
        if (newRefreshToken) {
            await saveToken('refresh_token', newRefreshToken);
            set({ accessToken: newAccessToken, refreshToken: newRefreshToken });
        } else {
            set((state) => ({ ...state, accessToken: newAccessToken }));
        }
    },

    loadSession: async () => {
        const accessToken = await getToken('access_token');
        const refreshToken = await getToken('refresh_token');
        const userDataString = await getToken('user_data');

        if (accessToken && refreshToken) {
            let user = null;
            if (userDataString) {
                try {
                    user = JSON.parse(userDataString);
                } catch (e) {
                    console.error("Failed to parse user data");
                }
            }
            set({ accessToken, refreshToken, user, isLoading: false });
            // TODO: Fetch user profile here to populate 'user' object
        } else {
            set({ accessToken: null, refreshToken: null, user: null, isLoading: false });
        }
    },
}));
