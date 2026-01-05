export const MOCK_HOTSPOTS = [
    {
        hotspot_id: 101,
        location: { type: 'Point', coordinates: [72.8777, 19.0760] }, // Mumbai
        radius_km: 12.5,
        intensity_score: 92.0,
        dominant_hazard_type: 'oil-spill', // Changed to string
        created_at: '2025-01-04T10:00:00Z',
        updated_at: '2025-01-04T12:00:00Z'
    },
    {
        hotspot_id: 102,
        location: { type: 'Point', coordinates: [80.2707, 13.0827] }, // Chennai
        radius_km: 8.0,
        intensity_score: 75.5,
        dominant_hazard_type: 'tsunami',
        created_at: '2025-01-03T08:30:00Z',
        updated_at: '2025-01-04T09:00:00Z'
    },
    {
        hotspot_id: 103,
        location: { type: 'Point', coordinates: [83.2185, 17.6868] }, // Visakhapatnam
        radius_km: 5.0,
        intensity_score: 60.0,
        dominant_hazard_type: 'high-wave',
        created_at: '2025-01-02T14:15:00Z',
        updated_at: '2025-01-03T10:00:00Z'
    },
    {
        hotspot_id: 104,
        location: { type: 'Point', coordinates: [76.2711, 9.9312] }, // Kochi
        radius_km: 15.0,
        intensity_score: 45.0,
        dominant_hazard_type: 'flood',
        created_at: '2025-01-04T16:00:00Z',
        updated_at: '2025-01-04T17:30:00Z'
    },
    {
        hotspot_id: 105,
        location: { type: 'Point', coordinates: [85.8245, 19.8135] }, // Puri/Odisha Coast
        radius_km: 25.0,
        intensity_score: 88.0,
        dominant_hazard_type: 'high-wave',
        created_at: '2025-01-01T09:00:00Z',
        updated_at: '2025-01-01T11:00:00Z'
    }
];
