import api from './api';
import { MOCK_HOTSPOTS } from './mockHotspots';

export interface Hotspot {
    hotspot_id: number;
    location: { type: string, coordinates: number[] }; // [lon, lat]
    radius_km: number;
    intensity_score: number;
    dominant_hazard_type: string;
    created_at: string;
    updated_at: string;
}

export interface Report {
    report_id: string;
    user_name: string;
    relevance_score: string;
    media_urls: string[];
    description: string;
    report_time: string;
    type_name: string;
    location: { coordinates: [number, number] }; // [lon, lat]
    type_id: number;
    status_name: string; // 'official_verified', etc.
}

export const fetchHotspots = async (): Promise<Hotspot[]> => {
    const response = await api.get('/hotspots/');
    return response.data.length > 0 ? response.data : MOCK_HOTSPOTS;
};

export const fetchReports = async (lat: number, lon: number, radius: number): Promise<Report[]> => {
    const response = await api.get('/reports/', {
        params: { lat, lon, radius_km: radius, limit: 50 }
    });
    return response.data.data;
};
// Add verification methods
export const verifyReport = async (reportId: string) => {
    // Matches requirement from frontend.txt 
    const response = await api.patch(`/reports/verify-user-report/${reportId}/`);
    return response.data;
};

export const debunkReport = async (reportId: string) => {
    // Matches requirement from frontend.txt 
    const response = await api.patch(`/reports/debunk-user-report/${reportId}/`);
    return response.data;
};
