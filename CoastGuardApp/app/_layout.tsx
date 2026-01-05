import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNetInfo } from '@react-native-community/netinfo';
import { syncReports } from '../services/syncService';
import "../global.css"; // NativeWind CSS import

const queryClient = new QueryClient();

export default function RootLayout() {
    const netInfo = useNetInfo();
    const { accessToken, isLoading, loadSession, user } = useAuthStore();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (netInfo.isConnected) {
            syncReports();
        }
    }, [netInfo.isConnected]);

    useEffect(() => {
        loadSession();
    }, []);

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (!accessToken && !inAuthGroup) {
            // Redirect to login if no accessToken and not already in auth group
            router.replace('/(auth)/login');
        } else if (accessToken && inAuthGroup) {
            // Redirect to app if accessToken exists and user is in auth group
            // Default to citizen for now, specific routing happens in login
            if (user?.role === "official")
                router.replace('/official/dashboard');
            else if (user?.role === "citizen")
                router.replace('/citizen')
        }
    }, [accessToken, isLoading, segments]);

    if (isLoading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-900">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <Slot />
        </QueryClientProvider>
    );
}
