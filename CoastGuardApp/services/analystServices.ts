import api from './api';

export interface AnalystData {
    volumeOverTime: { date: string; count: number }[];
    hazardTypeDistribution: { name: string; value: number; color: string }[];
    sentimentTrends: { date: string; negative: number; neutral: number; positive: number }[];
    recentRawData: any[]; // For the table/CSV export
}

// Mocking the response structure based on requirements
export const fetchAnalystData = async (filters: any): Promise<AnalystData> => {
    // In a real app, pass filters as params: { startDate, endDate, location... }
    // const response = await api.get('/data-analyst', { params: filters });
    // return response.data;

    // Returning MOCK DATA for now to visualize the charts immediately
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                volumeOverTime: [
                    { date: '2025-01-01', count: 12 },
                    { date: '2025-01-02', count: 19 },
                    { date: '2025-01-03', count: 35 },
                    { date: '2025-01-04', count: 22 },
                    { date: '2025-01-05', count: 45 },
                    { date: '2025-01-06', count: 30 },
                    { date: '2025-01-07', count: 55 },
                ],
                hazardTypeDistribution: [
                    { name: 'Tsunami', value: 400, color: '#ef4444' }, // Red
                    { name: 'High Waves', value: 300, color: '#3b82f6' }, // Blue
                    { name: 'Oil Spill', value: 300, color: '#10b981' }, // Green
                    { name: 'Flooding', value: 200, color: '#6b7280' }, // Gray
                ],
                sentimentTrends: [
                    { date: 'Mon', negative: 40, neutral: 24, positive: 24 },
                    { date: 'Tue', negative: 30, neutral: 13, positive: 22 },
                    { date: 'Wed', negative: 20, neutral: 58, positive: 22 },
                    { date: 'Thu', negative: 27, neutral: 39, positive: 20 },
                    { date: 'Fri', negative: 18, neutral: 48, positive: 21 },
                ],
                recentRawData: [
                    { id: 1, type: 'Tsunami', date: '2025-01-07', status: 'verified', location: 'Chennai' },
                    { id: 2, type: 'Oil Spill', date: '2025-01-07', status: 'pending', location: 'Mumbai' },
                    { id: 3, type: 'Flooding', date: '2025-01-06', status: 'debunked', location: 'Kochi' },
                ]
            });
        }, 1000);
    });
};
