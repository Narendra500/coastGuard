import React from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import ReportCard from '../../../components/Feed/ReportCard';
import { verifyReport, debunkReport } from '../../../services/mapServices';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AlertModal from '@/components/ui/AlertModal';
import { useState } from 'react';

// Fetch only UNVERIFIED reports 
const fetchUnverified = async () => {
    const response = await api.get('/reports', {
        params: { status: 'not_verified' } // Assuming 'not_verified' or ID 1
    });
    return response.data.data;
};

export default function TriageScreen() {
    const queryClient = useQueryClient();
    const [verifyAlertVisible, setVerifyAlertVisible] = useState(false);
    const [debunkAlertVisible, setDebunkAlertVisible] = useState(false);

    const { data: reports, isLoading, refetch } = useQuery({
        queryKey: ['unverified_reports'],
        queryFn: fetchUnverified,
    });

    const verifyMutation = useMutation({
        mutationFn: verifyReport,
        onSuccess: () => {
            setVerifyAlertVisible(true);
            < AlertModal
                visible={verifyAlertVisible}
                title="Request To Verify Report"
                message="Report verified successfully."
                onClose={() => setVerifyAlertVisible(false)
                }
            />
            queryClient.invalidateQueries({ queryKey: ['unverified_reports'] });
        }
    });

    const debunkMutation = useMutation({
        mutationFn: debunkReport,
        onSuccess: () => {
            setDebunkAlertVisible(true);
            < AlertModal
                visible={debunkAlertVisible}
                title="Request To Debunk Report"
                message="Report debunked successfully."
                onClose={() => setVerifyAlertVisible(false)
                }
            />
            queryClient.invalidateQueries({ queryKey: ['unverified_reports'] });
        }
    });

    return (
        <SafeAreaView className="flex-1 bg-gray-900" edges={['top']}>
            <View className="px-4 py-3 border-b border-gray-800 bg-blue-900/20">
                <Text className="text-xl font-bold text-blue-400">Incoming Triage Queue</Text>
                <Text className="text-gray-400 text-xs">Verify or Debunk citizen reports</Text>
            </View>

            {isLoading ? (
                <ActivityIndicator size="large" color="#3b82f6" className="mt-10" />
            ) : (
                <FlatList
                    data={reports}
                    keyExtractor={(item) => item.report_id}
                    refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#fff" />}
                    renderItem={({ item }) => (
                        <ReportCard
                            report={item}
                            showActions={true} // Enable buttons
                            onVerify={() => verifyMutation.mutate(item.report_id)}
                            onDebunk={() => debunkMutation.mutate(item.report_id)}
                        />
                    )}
                    ListEmptyComponent={
                        <View className="items-center mt-20">
                            <Ionicons name="checkmark-circle-outline" size={64} color="#10b981" />
                            <Text className="text-gray-400 mt-4">All caught up! No pending reports.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
