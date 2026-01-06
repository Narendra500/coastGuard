export interface MapMarker {
    id: string | number;
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
    pinColor?: string;
    onPress?: () => void;
}

export interface Region {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
}

export interface CoastMapRef {
    moveToRegion: (region: Region) => void;
}

export interface MapCircle {
    id: string | number;
    latitude: number;
    longitude: number;
    radius: number; // in meters
    fillColor: string;
    strokeColor: string;
    onPress?: () => void;
    title?: string;
    description?: string;
}

export interface CoastMapProps {
    latitude: number;
    longitude: number;
    markers?: MapMarker[];
    circles?: MapCircle[];
    className?: string;
    onRegionChangeComplete?: (region: Region) => void;
}
