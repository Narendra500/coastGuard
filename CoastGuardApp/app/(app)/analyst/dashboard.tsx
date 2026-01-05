import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { fetchAnalystData } from '../../../services/analystServices';
import { Ionicons } from '@expo/vector-icons';
// Import Recharts components (Web only)
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell,
    BarChart, Bar, Legend
} from 'recharts';

export default function AnalystDashboard() {
    const { data, isLoading } = useQuery({
        queryKey: ['analystData'],
        queryFn: fetchAnalystData,
    });

    if (Platform.OS !== 'web') {
        return (
            <View className="flex-1 bg-gray-900 justify-center items-center p-6">
                <Ionicons name="desktop-outline" size={64} color="#4b5563" />
                <Text className="text-gray-400 text-lg text-center mt-4">
                    The Analyst Dashboard is optimized for Desktop/Web view.
                    Please log in via the web portal to view advanced charts.
                </Text>
            </View>
        );
    }

    if (isLoading) {
        return (
            <View className="flex-1 bg-gray-900 justify-center items-center">
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <ScrollView className="flex-1 bg-gray-900 p-8">
            {/* Header */}
            <View className="flex-row justify-between items-center mb-8">
                <View>
                    <Text className="text-3xl font-bold text-white">Analyst Dashboard</Text>
                    <Text className="text-gray-400 mt-1">Situational awareness & historical analysis</Text>
                </View>
                <TouchableOpacity className="bg-blue-600 px-6 py-3 rounded-lg flex-row items-center hover:bg-blue-700">
                    <Ionicons name="download-outline" size={20} color="white" style={{ marginRight: 8 }} />
                    <Text className="text-white font-bold">Export CSV</Text>
                </TouchableOpacity>
            </View>

            {/* Top Row: Key Metrics Cards */}
            <View className="flex-row gap-6 mb-8 flex-wrap">
                <MetricCard title="Total Reports" value="1,245" change="+12%" color="blue" />
                <MetricCard title="Verified Incidents" value="843" change="+5%" color="green" />
                <MetricCard title="Avg Response Time" value="45m" change="-8%" color="yellow" />
            </View>

            {/* Chart Row 1 */}
            <View className="flex-row gap-8 mb-8 flex-wrap">
                {/* Volume Over Time  */}
                <View className="flex-1 bg-gray-800 p-6 rounded-2xl border border-gray-700 min-w-[400px]">
                    <Text className="text-white text-xl font-bold mb-6">Report Volume (7 Days)</Text>
                    <View style={{ height: 300, width: '100%' }}>
                        <ResponsiveContainer>
                            <AreaChart data={data?.volumeOverTime}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </View>
                </View>

                {/* Hazard Distribution [cite: 36] */}
                <View className="flex-1 bg-gray-800 p-6 rounded-2xl border border-gray-700 min-w-[300px]">
                    <Text className="text-white text-xl font-bold mb-6">Hazard Distribution</Text>
                    <View style={{ height: 300, width: '100%' }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={data?.hazardTypeDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {data?.hazardTypeDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </View>
                </View>
            </View>

            {/* Chart Row 2: Sentiment Analysis */}
            <View className="bg-gray-800 p-6 rounded-2xl border border-gray-700 mb-8 w-full">
                <Text className="text-white text-xl font-bold mb-6">Social Media Sentiment Trends</Text>
                <View style={{ height: 300, width: '100%' }}>
                    <ResponsiveContainer>
                        <BarChart data={data?.sentimentTrends}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#9ca3af" />
                            <YAxis stroke="#9ca3af" />
                            <Tooltip contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }} />
                            <Legend />
                            <Bar dataKey="positive" stackId="a" fill="#10b981" />
                            <Bar dataKey="neutral" stackId="a" fill="#6b7280" />
                            <Bar dataKey="negative" stackId="a" fill="#ef4444" />
                        </BarChart>
                    </ResponsiveContainer>
                </View>
            </View>

            {/* Raw Data Table (Preview) */}
            <View className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
                <View className="p-6 border-b border-gray-700 flex-row justify-between">
                    <Text className="text-white text-xl font-bold">Recent Raw Data</Text>
                    <Text className="text-blue-400 font-bold cursor-pointer">View All</Text>
                </View>
                <View>
                    <View className="flex-row bg-gray-700/50 p-4">
                        <Text className="flex-1 text-gray-400 font-bold">ID</Text>
                        <Text className="flex-1 text-gray-400 font-bold">Type</Text>
                        <Text className="flex-1 text-gray-400 font-bold">Location</Text>
                        <Text className="flex-1 text-gray-400 font-bold">Status</Text>
                    </View>
                    {data?.recentRawData.map((row) => (
                        <View key={row.id} className="flex-row p-4 border-b border-gray-700 hover:bg-gray-700/30">
                            <Text className="flex-1 text-white">#{row.id}</Text>
                            <Text className="flex-1 text-white">{row.type}</Text>
                            <Text className="flex-1 text-white">{row.location}</Text>
                            <Text className="flex-1 text-gray-300 capitalize">{row.status}</Text>
                        </View>
                    ))}
                </View>
            </View>
            <View className="h-20" />
        </ScrollView>
    );
}

// Simple Card Component
const MetricCard = ({ title, value, change, color }) => (
    <View className="flex-1 bg-gray-800 p-6 rounded-2xl border border-gray-700 min-w-[200px]">
        <Text className="text-gray-400 font-medium mb-2">{title}</Text>
        <Text className="text-3xl font-bold text-white mb-2">{value}</Text>
        <Text className={color === 'red' ? 'text-red-400' : 'text-green-400'}>
            {change} <Text className="text-gray-500">vs last week</Text>
        </Text>
    </View>
);
