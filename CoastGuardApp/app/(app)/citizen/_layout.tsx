import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useLocationTracking } from '@/hooks/useLocationTracking';

export default function CitizenLayout() {
    useLocationTracking();
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#111827', // gray-900
                    borderTopColor: '#374151', // gray-700
                },
                tabBarActiveTintColor: '#3b82f6', // blue-500
                tabBarInactiveTintColor: '#9ca3af', // gray-400
            }}
        >
            <Tabs.Screen
                name="index" // The Feed
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <Ionicons name="home" size={28} color={color} />,
                }}
            />
            <Tabs.Screen
                name="map" // The Map (Previously home.tsx)
                options={{
                    title: 'Map',
                    tabBarIcon: ({ color }) => <Ionicons name="map" size={28} color={color} />,
                }}
            />
            {/* Hidden tab for Report Form (we access it via FAB or button, not tab bar usually, but this works for now) */}
            <Tabs.Screen
                name="report"
                options={{
                    title: 'Post',
                    tabBarIcon: ({ color }) => (
                        <View className="bg-blue-600 p-2 rounded-full -mt-4 shadow-lg border-4 border-gray-900">
                            <Ionicons name="add" size={18} color="white" />
                        </View>
                    ),
                    tabBarStyle: { display: 'none' } // Hide tab bar on report screen
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <Ionicons name="person" size={28} color={color} />,
                }}
            />
        </Tabs>
    );
}
