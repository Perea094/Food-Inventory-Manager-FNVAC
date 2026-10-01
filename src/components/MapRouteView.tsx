'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface MapStop {
  id?: string;
  communityId?: string;
  name: string;
  municipality?: string;
  latitude: number;
  longitude: number;
  order: number;
  representativeName?: string;
  phone?: string;
  beneficiariesCount?: number;
}

export interface MapRouteViewProps {
  stops: MapStop[];
  cedisLocation?: { lat: number; lng: number; name: string };
  height?: string;
  className?: string;
  showReturnLeg?: boolean;
}

const DEFAULT_CEDIS = {
  lat: 20.5950,
  lng: -100.8160,
  name: 'CEDIS Celaya (FNVAC) - Origen de Ruta',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export const MapRouteView: React.FC<MapRouteViewProps> = ({
  stops,
  cedisLocation = DEFAULT_CEDIS,
  height = '460px',
  className = '',
  showReturnLeg = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        center: [cedisLocation.lat, cedisLocation.lng],
        zoom: 11,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const layersGroup = L.layerGroup().addTo(map);

      mapRef.current = map;
      layersGroupRef.current = layersGroup;

      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersGroupRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Update Markers, Polyline, and Fit Bounds whenever stops or CEDIS changes
  useEffect(() => {
    const map = mapRef.current;
    const layersGroup = layersGroupRef.current;
    if (!map || !layersGroup) return;

    layersGroup.clearLayers();

    // 1. CEDIS Celaya Origin Marker (distinctive warehouse icon and style)
    const cedisIcon = L.divIcon({
      className: 'cedis-origin-marker',
      html: `
        <div style="
          background: #136793;
          color: white;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 10px rgba(19, 103, 147, 0.45);
          border: 3px solid #ffffff;
          outline: 2px solid #d21e27;
          cursor: pointer;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
            <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
            <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
            <path d="M10 6h4"/>
            <path d="M10 10h4"/>
            <path d="M10 14h4"/>
            <path d="M10 18h4"/>
          </svg>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -22],
    });

    const cedisMarker = L.marker([cedisLocation.lat, cedisLocation.lng], {
      icon: cedisIcon,
      title: cedisLocation.name,
      zIndexOffset: 1000,
    });

    const cedisPopupContent = `
      <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 2px; min-width: 220px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #d21e27;"></span>
          <span style="font-size: 10px; font-weight: 800; color: #136793; text-transform: uppercase; letter-spacing: 0.5px;">Origen de Ruta</span>
        </div>
        <div style="font-size: 15px; font-weight: 800; color: #0f172a; line-height: 1.2;">
          CEDIS Celaya (FNVAC) - Origen de Ruta
        </div>
        <div style="font-size: 12px; color: #475569; margin-top: 4px;">
          Km. 9 Carr. San Miguel de Allende - Celaya
        </div>
        <div style="margin-top: 8px; font-size: 11px; background: #f0f7fb; border: 1px solid #bce0f6; color: #0c4360; padding: 4px 8px; border-radius: 6px; font-weight: 600;">
          Centro de Distribución y Almacenamiento FEFO
        </div>
      </div>
    `;

    cedisMarker.bindPopup(cedisPopupContent);
    layersGroup.addLayer(cedisMarker);

    // LatLng coordinates collection for auto-fit bounds
    const allCoords: [number, number][] = [[cedisLocation.lat, cedisLocation.lng]];
    const routeCoords: [number, number][] = [[cedisLocation.lat, cedisLocation.lng]];

    // 2. Delivery Stops Pins (Numbered 1, 2, 3...)
    stops.forEach((stop, index) => {
      const orderNum = stop.order || index + 1;
      const stopLatLng: [number, number] = [stop.latitude, stop.longitude];
      allCoords.push(stopLatLng);
      routeCoords.push(stopLatLng);

      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: `
          <div style="
            background: #2563eb;
            color: #ffffff;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 14px;
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            border: 2.5px solid #ffffff;
            cursor: pointer;
          ">
            ${orderNum}
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });

      const stopMarker = L.marker(stopLatLng, {
        icon: stopIcon,
        title: `Parada #${orderNum}: ${stop.name}`,
        zIndexOffset: 500 - orderNum,
      });

      const stopPopupContent = `
        <div style="font-family: system-ui, -apple-system, sans-serif; padding: 4px 2px; min-width: 220px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: 800; background: #dbeafe; color: #1e40af; padding: 2px 7px; border-radius: 9999px;">
              Parada #${orderNum}
            </span>
            ${
              stop.municipality
                ? `<span style="font-size: 11px; color: #64748b; font-weight: 600;">${escapeHtml(
                    stop.municipality
                  )}</span>`
                : ''
            }
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">
            ${escapeHtml(stop.name)}
          </div>
          ${
            stop.representativeName
              ? `<div style="font-size: 12px; color: #334155; margin-top: 6px;">
                  <strong style="color: #64748b;">Representante:</strong> ${escapeHtml(
                    stop.representativeName
                  )}
                </div>`
              : ''
          }
          ${
            stop.phone
              ? `<div style="font-size: 12px; color: #334155; margin-top: 2px;">
                  <strong style="color: #64748b;">Teléfono:</strong> <a href="tel:${escapeHtml(
                    stop.phone
                  )}" style="color: #2563eb; text-decoration: none;">${escapeHtml(stop.phone)}</a>
                </div>`
              : ''
          }
          ${
            stop.beneficiariesCount !== undefined
              ? `<div style="margin-top: 8px; font-size: 11px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; padding: 4px 8px; border-radius: 6px; font-weight: 600; display: flex; items-center; gap: 4px;">
                  <span>👥</span>
                  <span>${stop.beneficiariesCount} familias beneficiarias</span>
                </div>`
              : ''
          }
        </div>
      `;

      stopMarker.bindPopup(stopPopupContent);
      layersGroup.addLayer(stopMarker);
    });

    // 3. Route Polyline (CEDIS -> Stop 1 -> Stop 2 -> ... -> Stop N)
    if (stops.length > 0) {
      // Outbound delivery route polyline
      const outboundPolyline = L.polyline(routeCoords, {
        color: '#136793',
        weight: 5,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round',
      });
      layersGroup.addLayer(outboundPolyline);

      // Return leg back to CEDIS Celaya (round-trip closure)
      if (showReturnLeg) {
        const lastStop = stops[stops.length - 1];
        const returnCoords: [number, number][] = [
          [lastStop.latitude, lastStop.longitude],
          [cedisLocation.lat, cedisLocation.lng],
        ];
        const returnPolyline = L.polyline(returnCoords, {
          color: '#94a3b8',
          weight: 3,
          opacity: 0.75,
          dashArray: '8, 8',
          lineJoin: 'round',
        });
        layersGroup.addLayer(returnPolyline);
      }
    }

    // 4. Auto-fit bounds
    if (allCoords.length === 1) {
      map.setView([cedisLocation.lat, cedisLocation.lng], 11);
    } else {
      const bounds = L.latLngBounds(allCoords);
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
      });
    }

    // Trigger map invalidation to avoid rendering glitches
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [stops, cedisLocation, showReturnLeg]);

  return (
    <div className={`relative rounded-xl overflow-hidden border border-slate-200 shadow-sm ${className}`}>
      {/* Map Container */}
      <div
        ref={containerRef}
        style={{ height, width: '100%', minHeight: '350px' }}
        className="z-0"
      />

      {/* Floating Map Legend Overlay */}
      <div className="absolute top-3 right-3 z-[400] bg-white/95 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-md text-xs space-y-1.5 pointer-events-auto">
        <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-fnvac-blue-600"></span>
          <span>Ruta y Puntos de Entrega</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="w-3.5 h-3.5 rounded-full bg-fnvac-blue-600 border-2 border-white shadow-xs inline-block"></span>
          <span className="font-medium">CEDIS Celaya (Origen)</span>
        </div>
        <div className="flex items-center gap-2 text-slate-700">
          <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border-2 border-white shadow-xs inline-block text-[9px] text-white font-bold flex items-center justify-center">1</span>
          <span className="font-medium">Paradas de Entrega ({stops.length})</span>
        </div>
        {stops.length > 0 && (
          <>
            <div className="flex items-center gap-2 text-slate-600 pt-1 border-t border-slate-100">
              <span className="w-4 h-1 bg-fnvac-blue-600 rounded-full inline-block"></span>
              <span className="text-[11px]">Ruta de Entrega</span>
            </div>
            {showReturnLeg && (
              <div className="flex items-center gap-2 text-slate-500">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-slate-400 inline-block"></span>
                <span className="text-[11px]">Retorno a CEDIS</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MapRouteView;
