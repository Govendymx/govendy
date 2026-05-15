'use client';
import { useMap } from 'react-leaflet';
import { useEffect } from 'react';

interface LiveMapControllerProps {
  center: [number, number] | null;
  zoom: number;
}

export default function LiveMapController({ center, zoom }: LiveMapControllerProps) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, {
        animate: true,
        duration: 1.5
      });
    }
  }, [center, zoom, map]);

  return null;
}
