import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useReportStore } from '../../../store/reportStore';
import { useOfflineStore } from '../../../store/offlineStore'; // Import offline store
import { syncReports } from '../../../services/syncService'; // Import sync service
import { useNetInfo } from '@react-native-community/netinfo'; // Import NetInfo
import { router } from 'expo-router';
import api from '../../../services/api';
import uuid from "react-native-uuid"
import { useAuthStore } from '@/store/authStore';
import { showAlert } from '@/utils/alert';

export default function ReportScreen() {
    const { draft, setDraft, resetDraft } = useReportStore();
    const { addToQueue } = useOfflineStore();
    const netInfo = useNetInfo(); // Get real-time network status
    const [loadingLoc, setLoadingLoc] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [skip, setSkip] = useState(false);

    const toggleSkipState = () => {
        setSkip(!skip);
    };

    // 1. Get Location on Mount
    useEffect(() => {
        (async () => {
            setLoadingLoc(true);
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showAlert({ title: "location denied", message: "Permission to access location was denied" });
                setLoadingLoc(false);
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setDraft({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude
            });
            setLoadingLoc(false);
        })();
    }, []);

    // 2. Handle Image Picking
    const pickImage = async () => {
        // Request permission
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            alert('Sorry, we need camera roll permissions to make this work!');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled) {
            setDraft({ mediaUri: result.assets[0].uri });
        }
    };

    const uploadToCloudinary = async (uri: string) => {
        let uploadUri = uri;
        const filename = uploadUri.split('/').pop() || 'upload.jpg';
        const response = await fetch(uri);
        const blob = await response.blob();

        const data = new FormData();
        data.append('file', blob, filename);

        data.append('upload_preset', 'coastguard_uploads');
        data.append('resource_type', 'image');

        const res = await fetch(
            'https://api.cloudinary.com/v1_1/dlbn7fyrw/image/upload',
            {
                method: 'POST',
                body: data,
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        const json = await res.json();

        if (!res.ok) {
            console.log('Cloudinary error:', json);
            throw new Error(json?.error?.message);
        }

        console.log(json.secure_url);
        return json.secure_url;
    };
    const handleSubmit = async () => {
        if (!draft.latitude || !draft.longitude) {
            showAlert({ title: 'Error', message: 'Location is required.' });
            return;
        }
        if (!draft.text && !draft.mediaUri) {
            showAlert({ title: 'Error', message: 'Please add a description or a photo.' });
            return;
        }

        setIsSubmitting(true);

        // Prepare report object
        const reportData = {
            id: uuid.v4() as string,
            text: draft.text,
            type: draft.type,
            latitude: draft.latitude,
            longitude: draft.longitude,
            mediaUri: draft.mediaUri,
            timestamp: Date.now(),
        };

        // Check Network Status 
        if (netInfo.isConnected === false) {
            // OFFLINE: Save to local queue
            addToQueue(reportData);
            showAlert({ title: 'Offline', message: 'Report saved locally. It will upload when you are back online.' });
            resetDraft();
            router.back();
        } else {
            // ONLINE: Try to upload immediately
            try {
                let mediaUrl = "";
                if (draft.mediaUri) {
                    try {
                        mediaUrl = await uploadToCloudinary(draft.mediaUri);
                    } catch (err) {
                        showAlert({ title: "Upload Failed", message: "Could not upload image." });
                        setIsSubmitting(false);
                        return;
                    }
                }

                const payload = {
                    text: draft.text,
                    skip: skip,
                    type: draft.type,
                    latitude: draft.latitude,
                    longitude: draft.longitude,
                    mediaUrl: mediaUrl // Simple string string
                };

                await api.post('/reports/', payload);

                showAlert({ title: 'Success', message: 'Report uploaded successfully!' });
                resetDraft();
                router.back();

            } catch (error) {
                console.log("Upload failed, falling back to queue", error);
                // Fallback: If upload fails (e.g., weak signal), save to queue
                addToQueue(reportData);
                showAlert({ title: 'Saved', message: 'Upload failed, but report saved locally. Will retry later.' });
                resetDraft();
                router.back();
            }
        }

        setIsSubmitting(false);
    };

    return (
        <View className="flex-1 bg-gray-900">
            {/* Back Button */}
            <TouchableOpacity
                onPress={() => router.back()}
                className="absolute top-5 left-4 z-10 bg-gray-800/80 p-2 rounded-full"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="arrow-back" size={28} color="white" />
            </TouchableOpacity>

            <ScrollView className="flex-1 p-4">
                <Text className="text-center text-2xl mt-3 font-bold text-white mb-6">
                    New Hazard Report
                </Text>

                {/* Location Status */}
                <View className="mb-6 p-4 bg-gray-800 rounded-lg">
                    <Text className="text-gray-400 text-sm mb-1">Location</Text>
                    {loadingLoc ? (
                        <ActivityIndicator color="#3b82f6" />
                    ) : draft.latitude ? (
                        <Text className="text-green-400 font-mono">
                            {draft.latitude.toFixed(4)}, {draft.longitude?.toFixed(4)}
                        </Text>
                    ) : (
                        <Text className="text-red-400">Location not found</Text>
                    )}
                </View>

                {/* Hazard Type Selector */}
                <View className="mb-6">
                    <Text className="text-gray-400 mb-2">Hazard Type</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {["tsunami", "high-wave", "oil-spill", "flood"].map((hazard_type) => (
                            <TouchableOpacity
                                key={hazard_type}
                                onPress={() => setDraft({ type: hazard_type })}
                                className={`p-3 rounded-md ${draft.type === hazard_type ? 'bg-blue-600' : 'bg-gray-700'
                                    }`}
                            >
                                <Text className="text-white">{hazard_type}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            key={"skip"}
                            onPress={toggleSkipState}
                            className={`p-3 rounded-md ${skip ? 'bg-red-600' : 'bg-gray-700'
                                }`}
                        >
                            <Text className="text-white">Skip</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Description */}
                <View className="mb-6">
                    <Text className="text-gray-400 mb-2">Description</Text>
                    <TextInput
                        className="bg-gray-800 text-white p-4 rounded-xl border border-gray-700 h-32"
                        multiline
                        placeholder="Describe what you see..."
                        placeholderTextColor="#6b7280"
                        value={draft.text}
                        onChangeText={(t) => setDraft({ text: t })}
                        textAlignVertical="top"
                    />
                </View>

                {/* Media Picker */}
                <TouchableOpacity
                    onPress={pickImage}
                    className="mb-8 items-center justify-center bg-gray-800 h-40 rounded-xl border border-dashed border-gray-600"
                >
                    {draft.mediaUri ? (
                        <Image source={{ uri: draft.mediaUri }} className="w-full h-full rounded-xl" />
                    ) : (
                        <Text className="text-gray-400">Tap to add photo/video</Text>
                    )}
                </TouchableOpacity>

                {/* Submit Button */}
                <TouchableOpacity
                    onPress={handleSubmit}
                    className="w-full bg-green-600 p-4 rounded-xl items-center mb-10"
                >
                    <Text className="text-white font-bold text-lg">POST REPORT</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}
