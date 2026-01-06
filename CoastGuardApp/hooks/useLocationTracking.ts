import { useEffect } from 'react';
import * as Location from 'expo-location';
import api from '../services/api'; // Your axios instance

export const useLocationTracking = () => {
    useEffect(() => {
        const updateLocation = async () => {
            try {
                // 1. Check Permissions
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;

                // 2. Get Coordinates (Balanced accuracy saves battery)
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced
                });

                const { latitude, longitude } = loc.coords;

                // 3. Send to Backend
                await api.post('/users/update-location/', { latitude, longitude });
                console.log(`[Location Service] Updated: ${latitude}, ${longitude}`);

            } catch (error) {
                console.error("[Location Service] Update failed:", error);
            }
        };

        // Run immediately on mount
        updateLocation();

        // Run every 10 minutes (600,000 ms)
        const INTERVAL_MS = 10 * 60 * 1000;
        const intervalId = setInterval(updateLocation, INTERVAL_MS);

        // Cleanup on unmount
        return () => clearInterval(intervalId);
    }, []);
};
