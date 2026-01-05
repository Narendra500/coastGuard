import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export default function AnalystLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                // Move tabs to left on Web for "Twitter-style" sidebar feel [cite: 37]
                tabBarPosition: Platform.OS === 'web' ? 'left' : 'bottom',
                tabBarStyle: {
                    backgroundColor: '#111827', // Gray 900
                    borderRightColor: '#374151',
                    width: Platform.OS === 'web' ? 250 : '100%',
                    paddingTop: 20,
                },
                tabBarActiveTintColor: '#3b82f6',
                tabBarInactiveTintColor: '#9ca3af',
                tabBarLabelStyle: {
                    fontSize: 16,
                    fontWeight: 'bold',
                    marginLeft: 10,
                },
                tabBarItemStyle: {
                    flexDirection: 'row',
                    justifyContent: 'flex-start',
                    paddingLeft: 20,
                    marginBottom: 20,
                }
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Overview',
                    tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="query"
                options={{
                    title: 'Data Explorer',
                    tabBarIcon: ({ color }) => <Ionicons name="search" size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}
