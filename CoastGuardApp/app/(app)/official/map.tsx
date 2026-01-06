import React, { useState, useEffect, useRef } from 'react';
import { CoastMapRef, Region } from '@/components/Map/types';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { View, ScrollView, Platform, Text, TouchableOpacity, Modal, Keyboard, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import CoastMap from '@/components/Map/index.web';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location'
import { router } from 'expo-router';
import { fetchHotspots, fetchReports, verifyReport, debunkReport, Report } from '../../../services/mapServices';
import { useRouter } from 'expo-router';
import api from '@/services/api';

const MAPBOX_TOKEN = "pk.eyJ1IjoibmFyZW5kcmE1MDAiLCJhIjoiY21qeTBxa3ZwMDIxMjNjc2VwY3plaHV5diJ9.erZlLP54bgS1Z9gjcRlK1w";

const INDIA_CENTER = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 8.0,
    longitudeDelta: 8.0,
};

export default function OfficialDashboard() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // --- STATE MANAGEMENT ---
    const mapRef = useRef<CoastMapRef>(null);

    // Map & Location
    const [mapRegion, setMapRegion] = useState(INDIA_CENTER);
    const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);

    // UI Toggles
    const [selectedHotspot, setSelectedHotspot] = useState<any>(null);
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [showLegend, setShowLegend] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Red Alert Protocol State
    const [isRedAlertMode, setIsRedAlertMode] = useState(false);
    const [alertRadius, setAlertRadius] = useState(10); // Default 10km
    const [alertMessage, setAlertMessage] = useState("");
    const [broadcastLocation, setBroadcastLocation] = useState(INDIA_CENTER);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    // --- EFFECTS ---
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            setPermissionGranted(true);
            let loc = await Location.getCurrentPositionAsync({});
            setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        })();
    }, []);

    // --- DATA FETCHING ---
    const { data: hotspots } = useQuery({
        queryKey: ['hotspots'],
        queryFn: fetchHotspots,
        refetchInterval: 60000,
    });

    const { data: reports } = useQuery({
        queryKey: ['reports', userLocation?.latitude, userLocation?.longitude],
        queryFn: () => {
            if (!userLocation) return [];
            return fetchReports(userLocation.latitude, userLocation.longitude, 50);
        },
        enabled: !!userLocation && permissionGranted,
        refetchInterval: 60000,
    });

    // --- MUTATIONS ---
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

    const broadcastMutation = useMutation({
        mutationFn: async (payload: any) => {
            return await api.post('/alerts/broadcast/', payload);
        },
        onSuccess: () => {
            Alert.alert("BROADCAST SENT", "The alert has been pushed to the emergency queue.");
            setIsRedAlertMode(false);
            setAlertMessage("");
            setSearchQuery("");
        },
        onError: () => Alert.alert("FAILED", "Could not send broadcast. Check connection.")
    });

    // --- HANDLERS ---
    const handleSearchLocation = async () => {
        if (!searchQuery.trim()) return;
        Keyboard.dismiss();
        setIsSearching(true);

        try {
            const encodedQuery = encodeURIComponent(searchQuery);
            const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                const [longitude, latitude] = data.features[0].center;

                // 1. Prepare new region
                const newRegion = {
                    latitude,
                    longitude,
                    latitudeDelta: 0.5,
                    longitudeDelta: 0.5
                };

                // 2. Update Data State (Where the red circle goes)
                setBroadcastLocation(newRegion);
                setMapRegion(newRegion);

                // 3. FORCE MAP JUMP using Reference
                mapRef.current?.moveToRegion(newRegion);

            } else {
                Alert.alert("Location Not Found", "Try a more specific name.");
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Check connection.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleSendBroadcast = () => {
        if (!alertMessage.trim()) {
            Alert.alert("Error", "Please enter an alert message.");
            return;
        }
        setShowConfirmModal(true);
    };

    const executeBroadcast = () => {
        setShowConfirmModal(false);
        broadcastMutation.mutate({
            latitude: broadcastLocation.latitude,
            longitude: broadcastLocation.longitude,
            radius_km: alertRadius,
            message: alertMessage,
            hazard_type: "Manual Broadcast"
        });
    };

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

    // --- MAP OBJECTS ---
    const redAlertCircle = isRedAlertMode ? [{
        id: 'broadcast-zone',
        latitude: broadcastLocation.latitude,
        longitude: broadcastLocation.longitude,
        radius: alertRadius * 1000,
        fillColor: 'rgba(220, 38, 38, 0.3)',
        strokeColor: 'rgba(220, 38, 38, 1)',
    }] : [];

    const mapCircles = hotspots?.map(h => ({
        id: h.hotspot_id,
        latitude: h.location.coordinates[1],
        longitude: h.location.coordinates[0],
        radius: h.radius_km * 1000,
        fillColor: getHazardColor(h.dominant_hazard_type),
        strokeColor: 'rgba(255, 255, 255, 0.5)',
        onPress: () => setSelectedHotspot(h),
    }));

    const mapMarkers = reports?.map(r => ({
        id: r.report_id,
        latitude: r.location.coordinates[1],
        longitude: r.location.coordinates[0],
        pinColor: r.status_name === 'official_verified' ? 'green' : (r.status_name === 'fake' ? 'black' : 'red'),
        onPress: () => setSelectedReport(r),
    }));

    const activeCircles = isRedAlertMode ? [...(mapCircles || []), ...redAlertCircle] : mapCircles;

    return (
        <View className="flex-1 bg-gray-900">
            {/* --- MAP --- */}
            <CoastMap
                ref={mapRef} // Pass the ref here
                // Note: removed key prop
                latitude={isRedAlertMode ? broadcastLocation.latitude : mapRegion.latitude}
                longitude={isRedAlertMode ? broadcastLocation.longitude : mapRegion.longitude}
                circles={activeCircles}
                markers={mapMarkers}
                className="w-full h-full"
                onRegionChangeComplete={(region: Region) => {
                    if (isRedAlertMode && !isSearching) setBroadcastLocation(region);
                    else if (!isRedAlertMode) setMapRegion(region);
                }}
            />

            {/* --- LEGEND (Hidden in Red Alert) --- */}
            {!isRedAlertMode && (
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
            )}

            {/* --- RECENTER BUTTON --- */}
            {userLocation && !isRedAlertMode && (
                <TouchableOpacity
                    onPress={() => {
                        const newRegion = { ...userLocation, latitudeDelta: 0.05, longitudeDelta: 0.05 };
                        setMapRegion(newRegion);
                        mapRef.current?.moveToRegion(newRegion); // Use ref for smooth jump
                    }}
                    className="absolute top-12 right-4 bg-gray-800 p-3 rounded-full shadow-lg border border-gray-700"
                >
                    <Ionicons name="locate" size={24} color="white" />
                </TouchableOpacity>
            )}

            {/* --- RED ALERT BUTTON --- */}
            {!isRedAlertMode && (
                <TouchableOpacity
                    onPress={() => setIsRedAlertMode(true)}
                    className="absolute top-28 right-4 bg-red-600 p-3 rounded-full shadow-lg border-2 border-white/20 z-50"
                >
                    <Ionicons name="megaphone" size={24} color="white" />
                </TouchableOpacity>
            )}

            {/* --- RED ALERT CONSOLE --- */}
            {isRedAlertMode && (
                <View
                    className="absolute top-4 bottom-4 left-4 w-96 bg-gray-900 border border-red-600 p-6 rounded-2xl shadow-2xl z-50"
                    style={{ shadowColor: '#dc2626', shadowOpacity: 0.3, shadowRadius: 20 }}
                >
                    <View className="flex-row justify-between items-center mb-6">
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="warning" size={24} color="#ef4444" />
                            <Text className="text-red-500 font-black text-xl tracking-widest">RED ALERT</Text>
                        </View>
                        <TouchableOpacity onPress={() => setIsRedAlertMode(false)} className="bg-gray-800 p-1 rounded-full">
                            <Ionicons name="close" size={24} color="#9ca3af" />
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <Text className="text-gray-400 text-s mb-2 uppercase font-bold">1. Target Location</Text>
                    <View className="flex-row gap-2 mb-6">
                        <TextInput
                            className="flex-1 bg-gray-800 text-white p-3 rounded-lg border border-gray-700"
                            placeholder="e.g. Marina Beach"
                            placeholderTextColor="#6b7280"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearchLocation}
                        />
                        <TouchableOpacity onPress={handleSearchLocation} disabled={isSearching} className="bg-gray-700 px-4 justify-center rounded-lg border border-gray-600">
                            {isSearching ? <ActivityIndicator color="white" /> : <Ionicons name="search" size={20} color="white" />}
                        </TouchableOpacity>
                    </View>

                    {/* Radius Slider */}
                    <Text className="text-gray-400 text-s mb-2 uppercase font-bold">2. Broadcast Radius (km)</Text>
                    <View className="flex-row items-center justify-between bg-gray-800 p-4 rounded-lg mb-6 border border-gray-700">
                        <TouchableOpacity onPress={() => setAlertRadius(Math.max(1, alertRadius - 1))} className="p-2 bg-gray-700 rounded-full">
                            <Ionicons name="remove" size={20} color="white" />
                        </TouchableOpacity>
                        <Text className="text-white font-bold text-2xl">{alertRadius}</Text>
                        <TouchableOpacity onPress={() => setAlertRadius(alertRadius + 1)} className="p-2 bg-gray-700 rounded-full">
                            <Ionicons name="add" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Message Input */}
                    <Text className="text-gray-400 text-s mb-2 uppercase font-bold">3. Emergency Message</Text>
                    <TextInput
                        className="bg-gray-800 text-white p-4 rounded-lg border border-red-900/50 mb-4 h-64 text-lg align-top"
                        placeholder="Broadcast Message..."
                        placeholderTextColor="#7f1d1d"
                        multiline
                        textAlignVertical="top"
                        value={alertMessage}
                        onChangeText={setAlertMessage}
                    />

                    <View className="mt-auto">
                        <Text className="text-red-900/50 text-xs text-center mb-2 font-bold uppercase">This action cannot be undone</Text>
                        <TouchableOpacity
                            onPress={handleSendBroadcast}
                            disabled={broadcastMutation.isPending}
                            className="bg-red-600 py-4 rounded-xl items-center shadow-lg shadow-red-900/50"
                        >
                            {broadcastMutation.isPending ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-black text-lg tracking-widest">BROADCAST</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            <ConfirmationModal
                visible={showConfirmModal}
                title="CONFIRM RED ALERT"
                message={`Are you sure you want to alert ALL users within ${alertRadius}km of ${searchQuery}? This action cannot be undone.`}
                confirmText="BROADCAST"
                isDestructive={true}
                onConfirm={executeBroadcast}
                onCancel={() => setShowConfirmModal(false)}
            />
            {/* --- HOTSPOT DETAILS & TRIAGE MODAL --- */}
            {selectedHotspot && !isRedAlertMode && (
                <View className="absolute bottom-6 left-4 right-4 bg-gray-800 rounded-2xl p-5 border border-gray-700 shadow-2xl">

                    {/* Header: Title & Close Button */}
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

                        <TouchableOpacity
                            onPress={() => setSelectedHotspot(null)}
                            className="bg-gray-700 p-2 rounded-full"
                        >
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Stats Grid */}
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

                    {/* Time Info (Optional) */}
                    <View className="mt-4 pt-4 border-t border-gray-700">
                        <Text className="text-gray-500 text-xs italic">
                            Last updated: {new Date(selectedHotspot.updated_at).toLocaleString()}
                        </Text>
                    </View>
                </View>
            )}

            <Modal
                animationType="fade" // 'fade' looks better on web than 'slide'
                transparent={true}
                visible={!!selectedReport}
                onRequestClose={() => setSelectedReport(null)}
            >
                <View className={`flex-1 bg-black/60 ${Platform.OS === 'web' ? 'justify-center items-center p-8' : 'justify-end'}`}>

                    {/* Backdrop Tap to Close */}
                    <TouchableOpacity
                        className="absolute inset-0"
                        onPress={() => setSelectedReport(null)}
                    />

                    {/* Modal Container */}
                    <View className={`bg-gray-800 border border-gray-700 overflow-hidden 
            ${Platform.OS === 'web'
                            ? 'w-[600px] max-w-full rounded-2xl max-h-[90%] shadow-2xl' // Web: Centered Card
                            : 'rounded-t-3xl h-[70%] w-full' // Mobile: Bottom Sheet
                        }`}
                    >
                        {/* Scrollable Content */}
                        <ScrollView className="flex-1 p-6">

                            {/* Drag Handle (Mobile Only) */}
                            {Platform.OS !== 'web' && (
                                <View className="w-12 h-1 bg-gray-600 rounded-full self-center mb-6" />
                            )}

                            {/* Web Close Button (Top Right) */}
                            {Platform.OS === 'web' && (
                                <TouchableOpacity
                                    onPress={() => setSelectedReport(null)}
                                    className="absolute top-0 right-0 p-4 z-50"
                                >
                                    <Ionicons name="close" size={24} color="#9ca3af" />
                                </TouchableOpacity>
                            )}

                            {selectedReport && (
                                <>
                                    {/* Header Section */}
                                    <View className="flex-row justify-between items-start mb-6">
                                        <View>
                                            <Text className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                                                Incident #{selectedReport.report_id}
                                            </Text>
                                            <Text className="text-3xl font-bold text-white capitalize">
                                                {selectedReport.type_name || `Type ${selectedReport.type_id}`}
                                            </Text>
                                        </View>
                                        <View className="bg-blue-900/50 px-3 py-1 mr-[33%] rounded-full border border-blue-500">
                                            <Text className="text-blue-400 font-bold">Confidence score: {selectedReport.relevance_score}</Text>
                                        </View>
                                    </View>

                                    {/* Metadata Grid */}
                                    <View className="flex-row gap-4 mb-6 flex-wrap">
                                        <View className="bg-gray-700/50 px-4 py-2 rounded-lg">
                                            <Text className="text-gray-400 text-xs uppercase">Reported By</Text>
                                            <Text className="text-white font-bold">{selectedReport.user_name || 'Anonymous'}</Text>
                                        </View>
                                        <View className="bg-gray-700/50 px-4 py-2 rounded-lg">
                                            <Text className="text-gray-400 text-xs uppercase">Time</Text>
                                            <Text className="text-white font-bold">
                                                {new Date(selectedReport.report_time).toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Media Gallery */}
                                    {selectedReport.media_urls && selectedReport.media_urls.length > 0 ? (
                                        <View className="mb-6">
                                            <Text className="text-gray-400 text-xs uppercase font-bold mb-3">
                                                Evidence ({selectedReport.media_urls.length})
                                            </Text>
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                {selectedReport.media_urls.map((url: string, index: number) => (
                                                    <TouchableOpacity key={index}>
                                                        <Image
                                                            source={{ uri: url }}
                                                            className="w-80 h-64 rounded-xl mr-3 bg-gray-700 border border-gray-600"
                                                            resizeMode="cover"
                                                        />
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    ) : (
                                        <View className="mb-6 p-6 bg-gray-700/30 rounded-xl border border-dashed border-gray-600 items-center justify-center">
                                            <Ionicons name="image-outline" size={32} color="#6b7280" />
                                            <Text className="text-gray-500 mt-2 italic">No images attached</Text>
                                        </View>
                                    )}

                                    {/* Description */}
                                    <View className="mb-8">
                                        <Text className="text-gray-400 text-xs uppercase font-bold mb-2">Description</Text>
                                        <Text className="text-gray-300 text-lg leading-7">
                                            {selectedReport.description || "No description provided by the user."}
                                        </Text>
                                    </View>
                                </>
                            )}
                        </ScrollView>

                        {/* Footer Actions (Conditional) */}
                        {selectedReport && (
                            <View className="p-6 border-t border-gray-700 bg-gray-800/50">
                                {/* CHECK: Is it already processed? */}
                                {['official_verified', 'fake'].includes(selectedReport.status_name) ? (
                                    <View className={`w-full py-4 rounded-xl items-center border 
                            ${selectedReport.status_name === 'official_verified'
                                            ? 'bg-green-900/20 border-green-500/50'
                                            : 'bg-red-900/20 border-red-500/50'}`}
                                    >
                                        <View className="flex-row items-center gap-2">
                                            <Ionicons
                                                name={selectedReport.status_name === 'official_verified' ? "checkmark-circle" : "alert-circle"}
                                                size={24}
                                                color={selectedReport.status_name === 'official_verified' ? "#4ade80" : "#ef4444"}
                                            />
                                            <Text className={`font-bold text-lg capitalize 
                                    ${selectedReport.status_name === 'official_verified' ? 'text-green-400' : 'text-red-400'}`}
                                            >
                                                Report {selectedReport.status_name === 'official_verified' ? 'Verified' : 'Debunked'}
                                            </Text>
                                        </View>
                                        <Text className="text-gray-500 text-xs mt-1">No further action needed</Text>
                                    </View>
                                ) : (
                                    // Not processed yet -> Show Action Buttons
                                    <View className="flex-row gap-4">
                                        <TouchableOpacity
                                            onPress={() => debunkMutation.mutate(selectedReport.report_id)}
                                            disabled={debunkMutation.isPending}
                                            className="flex-1 bg-gray-700 hover:bg-gray-600 py-4 rounded-xl items-center border border-gray-600 transition-colors"
                                        >
                                            {debunkMutation.isPending ? <ActivityIndicator color="white" /> : (
                                                <View className="flex-row items-center gap-2">
                                                    <Ionicons name="trash-outline" size={20} color="#d1d5db" />
                                                    <Text className="text-gray-300 font-bold">DEBUNK</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => verifyMutation.mutate(selectedReport.report_id)}
                                            disabled={verifyMutation.isPending}
                                            className="flex-1 bg-green-600 hover:bg-green-500 py-4 rounded-xl items-center shadow-lg shadow-green-900/50 transition-colors"
                                        >
                                            {verifyMutation.isPending ? <ActivityIndicator color="white" /> : (
                                                <View className="flex-row items-center gap-2">
                                                    <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                                                    <Text className="text-white font-bold">VERIFY REPORT</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
