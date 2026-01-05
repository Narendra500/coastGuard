import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function OfficialLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: { backgroundColor: '#111827', borderTopColor: '#374151' },
                tabBarActiveTintColor: '#3b82f6',
                tabBarInactiveTintColor: '#9ca3af',
            }}
        >
            <Tabs.Screen
                name="dashboard" // Official Feed
                options={{
                    title: 'Feed',
                    tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="triage" // THE NEW EXTRA TAB 
                options={{
                    title: 'Triage',
                    tabBarIcon: ({ color }) => <Ionicons name="shield-checkmark" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="map" // Map View
                options={{
                    title: 'Map',
                    tabBarIcon: ({ color }) => <Ionicons name="map" size={24} color={color} />,
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
