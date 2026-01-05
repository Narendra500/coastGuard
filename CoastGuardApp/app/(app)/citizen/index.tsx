import React from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import ReportCard from '../../../components/Feed/ReportCard';
import { SafeAreaView } from 'react-native-safe-area-context';

// Fetch public verified reports 
const fetchFeed = async () => {
    const response = await api.get('/reports/', {
        params: {} // In real app, remove status filter to see everything or filter by verified
    });
    return response.data.data;
};

export default function CitizenFeed() {
    const { data: reports, isLoading, refetch } = useQuery({
        queryKey: ['feed'],
        queryFn: fetchFeed,
    });
    console.log(reports);

    return (
        <SafeAreaView className="flex-1 bg-gray-900" edges={['top']}>
            <View className="px-4 py-3 border-b border-gray-800">
                <Text className="text-xl font-bold text-white">CoastGuard Feed</Text>
            </View>

            {isLoading ? (
                <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#3b82f6" />
                </View>
            ) : (
                <FlatList
                    data={reports}
                    keyExtractor={(item) => item.report_id}
                    renderItem={({ item }) => <ReportCard report={item} />}
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#fff" />}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ListEmptyComponent={
                        <Text className="text-gray-500 text-center mt-10">No reports found.</Text>
                    }
                />
            )}
        </SafeAreaView>
    );
}
