import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import CoastMap from '../../../components/Map/index.web';
import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { fetchHotspots, fetchReports } from '../../../services/mapServices';
import { Ionicons } from '@expo/vector-icons';

// Center of India (approx)
const INDIA_CENTER = {
    latitude: 20.5937,
    longitude: 78.9629,
    latitudeDelta: 30.0, // Large delta to show the whole country
    longitudeDelta: 30.0,
};

export default function DashboardScreen() {
    const router = useRouter();

    // 1. STATE: Map Viewport (Initialized to Full India)
    const [mapRegion, setMapRegion] = useState(INDIA_CENTER);

    // 2. STATE: Actual User Location (For fetching nearby reports)
    const [userLocation, setUserLocation] = useState<{ latitude: number, longitude: number } | null>(null);
    const [permissionGranted, setPermissionGranted] = useState(false);

    const [selectedHotspot, setSelectedHotspot] = useState<any>(null);
    const [showLegend, setShowLegend] = useState(true);

    // 3. Get User Location (But DO NOT override mapRegion automatically)
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            setPermissionGranted(true);

            let loc = await Location.getCurrentPositionAsync({});

            // Only set the query coordinates, don't force-zoom the map
            setUserLocation({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
            });
        })();
    }, []);

    // 4. Fetch Hotspots (Global - No Params)
    // The backend returns ALL hotspots, so we just display them all on the large map.
    const { data: hotspots } = useQuery({
        queryKey: ['hotspots'],
        queryFn: fetchHotspots,
        refetchInterval: 60000,
    });

    // 5. Fetch Reports (Local - Uses User Location)
    // We only fetch reports if we actually have the user's GPS coords.
    const { data: reports } = useQuery({
        queryKey: ['reports', userLocation?.latitude, userLocation?.longitude],
        queryFn: () => {
            if (!userLocation) return [];
            return fetchReports(userLocation.latitude, userLocation.longitude, 50); // Increased radius to 50km
        },
        enabled: !!userLocation && permissionGranted, // Only run if we have location
        refetchInterval: 60000,
    });

    const handleHotspotPress = (hotspot: any) => {
        // Instead of alert(), we set the state to show the custom card
        setSelectedHotspot(hotspot);
    };

    const getHazardColor = (typeName: string) => {
        switch (typeName?.toLowerCase()) {
            case 'tsunami': return 'rgba(239, 68, 68, 0.5)';   // Red
            case 'high-wave': return 'rgba(59, 130, 246, 0.5)'; // Blue
            case 'oil-spill': return 'rgba(16, 185, 129, 0.5)'; // Green
            case 'flood': return 'rgba(107, 114, 128, 0.5)';    // Gray
            default: return 'rgba(107, 114, 128, 0.5)';         // Default Gray
        }
    };
    console.log(hotspots)

    const mapCircles = hotspots?.map(h => ({
        id: h.hotspot_id,
        latitude: h.location.coordinates[1],
        longitude: h.location.coordinates[0],
        radius: h.radius_km * 2000,
        fillColor: getHazardColor(h.dominant_hazard_type),
        strokeColor: 'rgba(255, 255, 255, 0.8)',
        // NEW: Pass the click handler
        onPress: () => handleHotspotPress(h),
        title: `Hotspot ${h.hotspot_id}`,
        description: `${h.dominant_hazard_type} - Score: ${h.intensity_score}`
    }));

    console.log("reports", reports)
    const mapMarkers = reports?.map(r => ({
        id: r.report_id,
        latitude: r.location.coordinates[1],
        longitude: r.location.coordinates[0],
        title: r.status_name,
        pinColor: r.status_name === 'official_verified' ? 'green' : 'red',
        onPress: () => console.log('Marker pressed', r.report_id)
    }));
    const legendItems = [
        { label: 'Tsunami / Surge', color: 'bg-red-500' },
        { label: 'High Waves', color: 'bg-blue-500' },
        { label: 'Oil Spill', color: 'bg-emerald-500' },
        { label: 'Flooding', color: 'bg-gray-500' },
    ];
    return (
        <View className="flex-1 bg-gray-900">
            <CoastMap
                latitude={mapRegion.latitude}
                longitude={mapRegion.longitude}
                markers={mapMarkers} // Add this back if it was missing in your variable list
                circles={mapCircles}
                className="w-full h-full"
            />
            {/* --- MAP LEGEND --- */}
            <View className="absolute top-12 left-4">
                {/* Toggle Button (Mini Legend) */}
                <TouchableOpacity
                    onPress={() => setShowLegend(!showLegend)}
                    className="bg-gray-900/90 border border-gray-700 p-2 rounded-lg mb-2 self-start flex-row items-center space-x-2"
                >
                    <Ionicons name="map-outline" size={16} color="#9ca3af" />
                    <Text className="text-gray-300 text-xs font-bold">Legend</Text>
                    <Ionicons name={showLegend ? "chevron-up" : "chevron-down"} size={16} color="#9ca3af" />
                </TouchableOpacity>

                {/* Expanded Legend List */}
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

            {/* Recenter Button */}
            {userLocation && (
                <TouchableOpacity
                    onPress={() => setMapRegion({
                        latitude: userLocation.latitude,
                        longitude: userLocation.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05
                    })}
                    className="absolute top-20 right-4 bg-gray-800 p-3 rounded-full shadow-lg border border-gray-700"
                >
                    <Ionicons name="locate" size={24} color="white" />
                </TouchableOpacity>
            )}

            {/* Post Button (Hide if a hotspot is selected to avoid clutter) */}
            {!selectedHotspot && (
                <TouchableOpacity
                    onPress={() => router.push('/(app)/citizen/report')}
                    className="absolute bottom-24 right-6 bg-red-600 w-16 h-16 rounded-full items-center justify-center shadow-lg border-4 border-gray-900"
                >
                    <Ionicons name="add" size={32} color="white" />
                </TouchableOpacity>
            )}

            {/* --- CUSTOM HOTSPOT CARD --- */}
            {selectedHotspot && (
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
        </View>
    );
}
