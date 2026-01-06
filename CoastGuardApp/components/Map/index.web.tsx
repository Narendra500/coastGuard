import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import Map, { Marker, Source, Layer, MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { View } from 'react-native';
import { CoastMapProps, CoastMapRef } from './types';
import { Ionicons } from '@expo/vector-icons';

const MAPBOX_TOKEN = "pk.eyJ1IjoibmFyZW5kcmE1MDAiLCJhIjoiY21qeTBxa3ZwMDIxMjNjc2VwY3plaHV5diJ9.erZlLP54bgS1Z9gjcRlK1w";

export default forwardRef<CoastMapRef, CoastMapProps>(({
    latitude,
    longitude,
    markers,
    circles,
    className,
    onRegionChangeComplete
}, ref) => {

    const mapRef = useRef<MapRef>(null);

    useImperativeHandle(ref, () => ({
        moveToRegion: (region) => {
            // Convert Delta to Zoom level approx (0.05 delta ~ zoom 13)
            mapRef.current?.flyTo({
                center: [region.longitude, region.latitude],
                zoom: Math.round(Math.log2(360 / region.longitudeDelta)) + 1,
                duration: 2000
            });
        }
    }));

    const onMapClick = (event: any) => {
        // (Keep existing click logic)
        const feature = event.features?.[0];
        if (feature && feature.layer.id.startsWith('circle-layer-')) {
            const circleId = feature.layer.id.replace('circle-layer-', '');
            const circle = circles?.find(c => String(c.id) === circleId);
            if (circle && circle.onPress) circle.onPress();
        }
    };

    return (
        <View className={className || "h-full w-full"}>
            <Map
                ref={mapRef}
                initialViewState={{
                    longitude: longitude,
                    latitude: latitude,
                    zoom: 4
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/dark-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
                interactiveLayerIds={circles?.map(c => `circle-layer-${c.id}`)}
                onClick={onMapClick}
                onMoveEnd={(e) => {
                    if (onRegionChangeComplete) {
                        onRegionChangeComplete({
                            latitude: e.viewState.latitude,
                            longitude: e.viewState.longitude,
                            latitudeDelta: 10.0,
                            longitudeDelta: 10.0
                        });
                    }
                }}
            >
                {/* (Sources, Layers, and Markers code remains exactly the same) */}
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
                                'circle-radius': [
                                    'interpolate',
                                    ['exponential', 2],
                                    ['zoom'],
                                    0, 0,
                                    22, ['/', c.radius, 0.019]
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
});
