import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Image, Alert, ActivityIndicator } from 'react-native';
import CoastMap from '@/components/Map/index.web';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { fetchHotspots, fetchReports, verifyReport, debunkReport, Report } from '../../../services/mapServices';
import { useRouter } from 'expo-router';

const MAPBOX_TOKEN = "pk.eyJ1IjoibmFyZW5kcmE1MDAiLCJhIjoiY21qeTBxa3ZwMDIxMjNjc2VwY3plaHV5diJ9.erZlLP54bgS1Z9gjcRlK1w";

const INDIA_CENTER = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 22.0,
    longitudeDelta: 22.0,
};

export default function OfficialDashboard() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // 2. State Management
    const [mapRegion, setMapRegion] = useState(INDIA_CENTER);
    const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // UI State
    const [selectedHotspot, setSelectedHotspot] = useState<any>(null); // For Hotspot Card
    const [selectedReport, setSelectedReport] = useState<Report | null>(null); // For Triage Modal
    const [showLegend, setShowLegend] = useState(true);

    // 3. Location & Data Fetching
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            setPermissionGranted(true);
            let loc = await Location.getCurrentPositionAsync({});
            setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        })();
    }, []);

    // Fetch Hotspots (Global)
    const { data: hotspots } = useQuery({
        queryKey: ['hotspots'],
        queryFn: fetchHotspots,
        refetchInterval: 60000,
    });

    // Fetch Reports (Near User)
    const { data: reports } = useQuery({
        queryKey: ['reports', userLocation?.latitude, userLocation?.longitude],
        queryFn: () => {
            if (!userLocation) return [];
            return fetchReports(userLocation.latitude, userLocation.longitude, 50);
        },
        enabled: !!userLocation && permissionGranted,
        refetchInterval: 60000,
    });

    // 4. Mutations (Verify/Debunk)
    const verifyMutation = useMutation({
        mutationFn: verifyReport,
        onSuccess: () => {
            Alert.alert("Success", "Report verified successfully.");
            setSelectedReport(null);
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
        onError: () => Alert.alert("Error", "Failed to verify report.")
    });

    const debunkMutation = useMutation({
        mutationFn: debunkReport,
        onSuccess: () => {
            Alert.alert("Success", "Report marked as fake.");
            setSelectedReport(null);
            queryClient.invalidateQueries({ queryKey: ['reports'] });
        },
        onError: () => Alert.alert("Error", "Failed to debunk report.")
    });

    // 5. Helpers
    const getHazardColor = (typeName: string) => {
        switch (typeName?.toLowerCase()) {
            case 'tsunami': return 'rgba(239, 68, 68, 0.5)';
            case 'high-wave': return 'rgba(59, 130, 246, 0.5)';
            case 'oil-spill': return 'rgba(16, 185, 129, 0.5)';
            case 'flood': return 'rgba(107, 114, 128, 0.5)';
            default: return 'rgba(107, 114, 128, 0.5)';
        }
    };

    const legendItems = [
        { label: 'Tsunami / Surge', color: 'bg-red-500' },
        { label: 'High Waves', color: 'bg-blue-500' },
        { label: 'Oil Spill', color: 'bg-emerald-500' },
        { label: 'Flooding', color: 'bg-gray-500' },
    ];

    // 6. Map Objects
    const mapCircles = hotspots?.map(h => ({
        id: h.hotspot_id,
        latitude: h.location.coordinates[1],
        longitude: h.location.coordinates[0],
        radius: h.radius_km * 5000,
        fillColor: getHazardColor(h.dominant_hazard_type),
        strokeColor: 'rgba(255, 255, 255, 0.5)',
        onPress: () => setSelectedHotspot(h),
    }));

    const mapMarkers = reports?.map(r => ({
        id: r.report_id,
        latitude: r.location.coordinates[1],
        longitude: r.location.coordinates[0],
        // Official View: Green=Verified, Black=Fake, Red=Unverified
        pinColor: r.status_name === 'official_verified' ? 'green' : (r.status_name === 'fake' ? 'black' : 'red'),
        onPress: () => setSelectedReport(r),
    }));

    return (
        <View className="flex-1 bg-gray-900">
            {/* Unified Map Component */}
            <CoastMap
                latitude={mapRegion.latitude}
                longitude={mapRegion.longitude}
                markers={mapMarkers}
                circles={mapCircles}
                className="w-full h-full"
            />

            {/* --- MAP LEGEND (Top Left) --- */}
            <View className="absolute top-12 left-4">
                <TouchableOpacity
                    onPress={() => setShowLegend(!showLegend)}
                    className="bg-gray-900/90 border border-gray-700 p-2 rounded-lg mb-2 self-start flex-row items-center space-x-2"
                >
                    <Ionicons name="map-outline" size={16} color="#9ca3af" />
                    <Text className="text-gray-300 text-xs font-bold">Legend</Text>
                    <Ionicons name={showLegend ? "chevron-up" : "chevron-down"} size={16} color="#9ca3af" />
                </TouchableOpacity>

                {showLegend && (
                    <View className="bg-gray-900/90 p-3 rounded-xl border border-gray-700 shadow-lg w-40">
                        {legendItems.map((item, index) => (
                            <View key={index} className="flex-row items-center mb-2 last:mb-0">
                                <View className={`w-3 h-3 rounded-full mr-2 ${item.color} border border-white/20`} />
                                <Text className="text-gray-300 text-xs font-medium">{item.label}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </View>

            {/* --- RECENTER BUTTON (Top Right) --- */}
            {userLocation && (
                <TouchableOpacity
                    onPress={() => setMapRegion({
                        latitude: userLocation.latitude,
                        longitude: userLocation.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05
                    })}
                    className="absolute top-12 right-4 bg-gray-800 p-3 rounded-full shadow-lg border border-gray-700"
                >
                    <Ionicons name="locate" size={24} color="white" />
                </TouchableOpacity>
            )}

            {/* --- HOTSPOT DETAILS CARD (Bottom Overlay) --- */}
            {selectedHotspot && (
                <View className="absolute bottom-6 left-4 right-4 bg-gray-800 rounded-2xl p-5 border border-gray-700 shadow-2xl">
                    <View className="flex-row justify-between items-start mb-4">
                        <View>
                            <View className="flex-row items-center mb-1">
                                <View
                                    className="w-3 h-3 rounded-full mr-2"
                                    style={{ backgroundColor: getHazardColor(selectedHotspot.dominant_hazard_type).replace('0.5', '1') }}
                                />
                                <Text className="text-gray-400 text-xs uppercase font-bold tracking-widest">
                                    Hotspot #{selectedHotspot.hotspot_id}
                                </Text>
                            </View>
                            <Text className="text-white text-3xl font-bold capitalize">
                                {selectedHotspot.dominant_hazard_type}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedHotspot(null)} className="bg-gray-700 p-2 rounded-full">
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1 bg-gray-900/60 p-3 rounded-xl border border-gray-700/50">
                            <Text className="text-gray-400 text-xs mb-1">Intensity Score</Text>
                            <Text className="text-blue-400 text-xl font-bold">
                                {selectedHotspot.intensity_score}<Text className="text-sm text-gray-500">/100</Text>
                            </Text>
                        </View>
                        <View className="flex-1 bg-gray-900/60 p-3 rounded-xl border border-gray-700/50">
                            <Text className="text-gray-400 text-xs mb-1">Affected Radius</Text>
                            <Text className="text-white text-xl font-bold">
                                {selectedHotspot.radius_km} <Text className="text-sm text-gray-500">km</Text>
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* --- TRIAGE MODAL (For Verifying Reports) --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={!!selectedReport}
                onRequestClose={() => setSelectedReport(null)}
            >
                <View className="flex-1 justify-end">
                    <TouchableOpacity className="absolute inset-0 bg-black/60" onPress={() => setSelectedReport(null)} />
                    <View className="bg-gray-800 rounded-t-3xl p-6 h-[55%] border-t border-gray-700">
                        <View className="w-12 h-1 bg-gray-600 rounded-full self-center mb-6" />

                        {selectedReport && (
                            <>
                                <View className="flex-row justify-between items-start mb-4">
                                    <View>
                                        <Text className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                                            Incident Report #{selectedReport.report_id}
                                        </Text>
                                        <Text className="text-2xl font-bold text-white capitalize">
                                            {selectedReport.type_name || `Type ${selectedReport.type_id}`}
                                        </Text>
                                    </View>
                                    <View className="bg-blue-900/50 px-3 py-1 rounded-full border border-blue-500">
                                        <Text className="text-blue-400 font-bold">AI Score: 8.5</Text>
                                    </View>
                                </View>

                                <Text className="text-gray-300 mb-2 leading-6">
                                    Status: <Text className="font-bold text-white capitalize">{selectedReport.status_name.replace('_', ' ')}</Text>
                                </Text>

                                <Text className="text-gray-400 text-sm mb-6">
                                    Reported: {new Date(selectedReport.report_time).toLocaleString()}
                                </Text>

                                {/* Action Buttons */}
                                <View className="flex-row gap-4 mt-auto mb-6">
                                    <TouchableOpacity
                                        onPress={() => debunkMutation.mutate(selectedReport.report_id)}
                                        disabled={debunkMutation.isPending}
                                        className="flex-1 bg-gray-700 py-4 rounded-xl items-center border border-gray-600 active:bg-gray-600"
                                    >
                                        {debunkMutation.isPending ? <ActivityIndicator color="white" /> : (
                                            <Text className="text-gray-300 font-bold">DEBUNK</Text>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => verifyMutation.mutate(selectedReport.report_id)}
                                        disabled={verifyMutation.isPending}
                                        className="flex-1 bg-green-600 py-4 rounded-xl items-center shadow-lg shadow-green-900/50 active:bg-green-500"
                                    >
                                        {verifyMutation.isPending ? <ActivityIndicator color="white" /> : (
                                            <Text className="text-white font-bold">VERIFY</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
