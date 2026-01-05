import React from 'react';
import Map, { Marker, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { View } from 'react-native';
import { CoastMapProps } from './types';
import { Ionicons } from '@expo/vector-icons';

const MAPBOX_TOKEN = "pk.eyJ1IjoibmFyZW5kcmE1MDAiLCJhIjoiY21qeTBxa3ZwMDIxMjNjc2VwY3plaHV5diJ9.erZlLP54bgS1Z9gjcRlK1w";

export default function CoastMap({ latitude, longitude, markers, circles, className }: CoastMapProps) {
    // Handle clicks on the map layers
    const onMapClick = (event: any) => {
        const feature = event.features?.[0];
        if (feature && feature.layer.id.startsWith('circle-layer-')) {
            // Find the circle data that matches this ID to call its specific onPress
            const circleId = feature.layer.id.replace('circle-layer-', '');
            const circle = circles?.find(c => String(c.id) === circleId);
            if (circle && circle.onPress) {
                circle.onPress();
            }
        }
    };

    return (
        <View className={className || "h-full w-full"}>
            <Map
                initialViewState={{
                    longitude: longitude,
                    latitude: latitude,
                    zoom: 4 // Zoomed out to see India
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
                interactiveLayerIds={circles?.map(c => `circle-layer-${c.id}`)} // Make circles clickable
                onClick={onMapClick}
            >
                {circles?.map((c) => (
                    <Source
                        key={`source-${c.id}`}
                        type="geojson"
                        data={{
                            type: 'Feature',
                            geometry: { type: 'Point', coordinates: [c.longitude, c.latitude] },
                            properties: {}
                        }}
                    >
                        <Layer
                            id={`circle-layer-${c.id}`}
                            type="circle"
                            paint={{
                                // FIX: Physically accurate meters-to-pixels approximation
                                // At latitude ~0, 1px is roughly X meters depending on zoom.
                                // This formula scales the pixel size exponentially with zoom to mimic physical size.
                                'circle-radius': [
                                    'interpolate',
                                    ['exponential', 2],
                                    ['zoom'],
                                    0, 0,
                                    22, ['/', c.radius, 0.019] // Rough calibration constant for physical scale
                                ],
                                'circle-color': c.fillColor,
                                'circle-stroke-color': c.strokeColor,
                                'circle-stroke-width': 2,
                                'circle-opacity': 0.5
                            }}
                        />
                    </Source>
                ))}

                {markers?.map((m) => (
                    <Marker
                        key={m.id}
                        longitude={m.longitude}
                        latitude={m.latitude}
                        anchor="bottom"
                        onClick={(e) => {
                            e.originalEvent.stopPropagation();
                            if (m.onPress) m.onPress();
                        }}
                    >
                        <Ionicons name="location" size={30} color={m.pinColor || 'red'} />
                    </Marker>
                ))}
            </Map>
        </View>
    );
}
