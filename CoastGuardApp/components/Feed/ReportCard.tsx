import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ReportCardProps {
    report: any; // Type strictly in real app
    onPress?: () => void;
    showActions?: boolean; // For Official Triage
    onVerify?: () => void;
    onDebunk?: () => void;
}

export default function ReportCard({ report, onPress, showActions, onVerify, onDebunk }: ReportCardProps) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8} className="self-center md:w-5/12 w-full h-fit bg-gray-800 p-4 border-b border-gray-700">
            {/* Header: User Info */}
            <View className="flex-row items-center mb-2">
                <View className="w-10 h-10 bg-gray-600 rounded-full items-center justify-center mr-3">
                    <Text className="text-white font-bold">{report.user_name.substring(0, 1) || 'U'}</Text>
                </View>
                <View>
                    <Text className="text-white font-bold text-base">{report.user_name}</Text>
                    <Text className="text-gray-400 text-xs">
                        {new Date(report.report_time).toLocaleDateString()} • {report.type_name}
                    </Text>
                </View>
                <View className={`ml-auto px-2 py-1 rounded-full ${Number(report.relevance_score) < 0.50 ? 'bg-red-900/50 border border-red-500' :
                    Number(report.relevance_score) < 0.75 ? 'bg-yellow-900/50 border border-yellow-500' : 'bg-green-900/50 border border-green-500'} 
                    }`}>
                    <Text className={`text-xs font-bold ${Number(report.relevance_score) < 0.50 ? 'text-red-400' :
                        Number(report.relevance_score) < 0.75 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                        {report.relevance_score < 0.50 ? 'Unreliable' : report.relevance_score < 0.75 ? 'Trust with caution' : 'Trustable'}
                    </Text>
                </View>
                {/* Status Badge */}
                <View className={`ml-auto px-2 py-1 rounded-full ${report.status_name === 'official_verified' ? 'bg-green-900/50 border border-green-500' :
                    report.status_name === 'official_debunked' ? 'bg-red-900/50 border border-red-500' : 'bg-yellow-900/50 border border-yellow-500'
                    }`}>
                    <Text className={`text-xs font-bold ${report.status_name === 'official_verified' ? 'text-green-400' :
                        report.status_name === 'official_debunked' ? 'text-red-400' : 'text-yellow-400'
                        }`}>
                        {report.status_name === 'official_verified' ? 'Verified' : report.status_name === "official_debunked" ? "Debunked" : 'Not Verified'}
                    </Text>
                </View>
            </View>

            {/* Content */}
            <Text className="text-white text-base mb-3 leading-6">{report.description || "No description provided."}</Text>

            {/* Media (if exists) */}
            {
                report.media_urls && report.media_urls.length > 0 && (
                    <Image
                        source={{ uri: report.media_urls[0] }}
                        className="w-full h-56 rounded-xl mb-3 bg-gray-700"
                        resizeMode="cover"
                    />
                )
            }

            {/* Official Actions (Only if requested) */}
            {
                showActions && (
                    <View className="flex-row gap-3 mt-2 border-t border-gray-700 pt-3">
                        <TouchableOpacity onPress={onDebunk} className="flex-1 bg-gray-700 py-2 rounded-lg items-center">
                            <Text className="text-gray-300 font-bold">Debunk</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onVerify} className="flex-1 bg-green-700 py-2 rounded-lg items-center">
                            <Text className="text-white font-bold">Verify</Text>
                        </TouchableOpacity>
                    </View>
                )
            }
        </TouchableOpacity >
    );
}
