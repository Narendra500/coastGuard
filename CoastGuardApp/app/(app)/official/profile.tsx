import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Image, Platform } from 'react-native';
import { useAuthStore } from '../../../store/authStore';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { useQuery } from '@tanstack/react-query';

const fetchProfile = async (userID: string) => {
    if (!userID) throw new Error("No User ID");
    const response = await api.get(`/auth/profile/${userID}`);
    return response.data.userData;
};

export default function ProfileScreen() {
    // 1. Call the hook inside the component
    const { logout, user } = useAuthStore();
    const userID = user?.userID;

    // 2. Pass the userID to the query function
    const { data: profile, error } = useQuery({
        queryKey: ['profile', userID], // Add userID to key so it refetches if user changes
        queryFn: () => fetchProfile(userID || ""),
        enabled: !!userID, // Only fetch if we actually have a userID
        retry: false,
    });

    if (error) console.log("Profile Fetch Error:", error);

    const handleLogout = async () => {
        const performLogout = async () => {
            await logout();
            router.replace('/(auth)/login');
        };

        if (Platform.OS === 'web') {
            const confirmed = window.confirm("Are you sure you want to log out?");
            if (confirmed) {
                await performLogout();
            }
        } else {
            Alert.alert(
                "Log Out",
                "Are you sure you want to log out?",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Log Out",
                        style: "destructive",
                        onPress: performLogout
                    }
                ]
            );
        }
    };

    const displayUser = profile || user || { Username: 'Citizen', Email: 'Loading...', Role: 'citizen' };

    return (
        <View className="flex-1 bg-gray-900 p-6">
            {/* Header */}
            <View className="flex-row items-center mb-10 mt-4">
                <TouchableOpacity onPress={() => router.back()} className="p-2 bg-gray-800 rounded-full mr-4">
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text className="text-2xl font-bold text-white">Profile</Text>
            </View>

            {/* User Info Card */}
            <View className="items-center mb-10">
                <View className="w-24 h-24 bg-gray-700 rounded-full items-center justify-center mb-4 border-2 border-blue-500">
                    <Text className="text-4xl text-white font-bold">
                        {displayUser.Username?.charAt(0).toUpperCase()}
                    </Text>
                </View>
                <Text className="text-2xl font-bold text-white mb-1">
                    {displayUser.Username}
                </Text>
                <Text className="text-gray-400 mb-2">{displayUser.Email}</Text>
                <View className="bg-blue-900 px-3 py-1 rounded-full">
                    <Text className="text-blue-200 text-xs font-bold uppercase tracking-wider">
                        {displayUser.Role}
                    </Text>
                </View>
            </View>

            {/* Settings Options */}
            <View className="items-center">
                <View className="lg:w-1/2 w-full bg-gray-800 rounded-2xl p-4 mb-6">
                    <TouchableOpacity className="flex-row items-center py-4 border-b border-gray-700">
                        <Ionicons name="settings-outline" size={22} color="#9ca3af" />
                        <Text className="text-white text-lg ml-4 flex-1">App Settings</Text>
                        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                    </TouchableOpacity>
                    <TouchableOpacity className="flex-row items-center py-4">
                        <Ionicons name="help-circle-outline" size={22} color="#9ca3af" />
                        <Text className="text-white text-lg ml-4 flex-1">Help & Support</Text>
                        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Logout Button */}
            <View className="mt-14 items-center">
                <TouchableOpacity
                    onPress={handleLogout}
                    className="lg:w-1/2 w-full flex-row items-center justify-center bg-red-600/10 border border-red-600 p-4 rounded-xl mt-auto mb-6"
                >
                    <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                    <Text className="text-red-500 font-bold text-lg ml-2">Log Out</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
