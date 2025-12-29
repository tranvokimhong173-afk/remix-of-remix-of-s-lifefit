import { MapPin, AlertTriangle, Shield, Navigation, Loader2 } from "lucide-react";
import { GoogleMap, Marker, Circle } from "@react-google-maps/api";
import { useMemo, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useGeolocation } from "@/hooks/useGeolocation";

interface MapSectionProps {
  position: string;
  safeRadius: string;
  lat?: number;
  lng?: number;
  safeCenterLat?: number;
  safeCenterLng?: number;
  useRealtimeGPS?: boolean;
  onLocationUpdate?: (lat: number, lng: number) => void;
}

// Haversine formula to calculate distance between two coordinates in meters
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const MapSection = ({ 
  position, 
  safeRadius, 
  lat = 10.762622, 
  lng = 106.660172,
  safeCenterLat,
  safeCenterLng,
  useRealtimeGPS = false,
  onLocationUpdate
}: MapSectionProps) => {
  const { isLoaded } = useGoogleMaps();
  const geoLocation = useGeolocation(true);

  // Use GPS position if realtime GPS is enabled and available
  const effectiveLat = useRealtimeGPS && geoLocation.latitude ? geoLocation.latitude : lat;
  const effectiveLng = useRealtimeGPS && geoLocation.longitude ? geoLocation.longitude : lng;

  // Notify parent of location updates
  useEffect(() => {
    if (useRealtimeGPS && geoLocation.latitude && geoLocation.longitude && onLocationUpdate) {
      onLocationUpdate(geoLocation.latitude, geoLocation.longitude);
    }
  }, [useRealtimeGPS, geoLocation.latitude, geoLocation.longitude, onLocationUpdate]);

  const center = useMemo(() => ({ lat: effectiveLat, lng: effectiveLng }), [effectiveLat, effectiveLng]);
  
  // Safe zone center defaults to initial position if not specified
  const safeCenter = useMemo(() => ({
    lat: safeCenterLat ?? 10.762622,
    lng: safeCenterLng ?? 106.660172
  }), [safeCenterLat, safeCenterLng]);
  
  const mapContainerStyle = {
    width: "100%",
    height: "400px",
  };

  const radiusInMeters = useMemo(() => {
    const match = safeRadius.match(/(\d+)/);
    return match ? parseInt(match[1]) : 100;
  }, [safeRadius]);

  // Check if current position is outside safe zone
  const distanceFromCenter = useMemo(() => {
    return calculateDistance(effectiveLat, effectiveLng, safeCenter.lat, safeCenter.lng);
  }, [effectiveLat, effectiveLng, safeCenter]);

  const isOutsideSafeZone = distanceFromCenter > radiusInMeters;

  // Create marker icons only when Google Maps is loaded
  const currentPositionIcon = useMemo(() => {
    if (!isLoaded || !window.google) return undefined;
    if (!isOutsideSafeZone) return undefined;
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#ef4444",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    };
  }, [isLoaded, isOutsideSafeZone]);

  const safeCenterIcon = useMemo(() => {
    if (!isLoaded || !window.google) return undefined;
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#22c55e",
      fillOpacity: 0.8,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    };
  }, [isLoaded]);

  return (
    <div className="w-full rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-destructive to-destructive/60 flex items-center justify-center shadow-lg">
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-destructive to-destructive/70 bg-clip-text text-transparent">
              Vị trí hiện tại
            </h2>
          </div>
          
          {/* GPS Status Indicator */}
          {useRealtimeGPS && (
            <div className="flex items-center gap-2">
              {geoLocation.isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Đang lấy vị trí...</span>
                </div>
              ) : geoLocation.isWatching ? (
                <div className="flex items-center gap-2 text-primary text-sm">
                  <Navigation className="h-4 w-4 animate-pulse" />
                  <span>GPS realtime</span>
                  {geoLocation.accuracy && (
                    <span className="text-xs text-muted-foreground">
                      (±{Math.round(geoLocation.accuracy)}m)
                    </span>
                  )}
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => geoLocation.startWatching()}
                  className="gap-2"
                >
                  <Navigation className="h-4 w-4" />
                  Bật GPS
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Safe Zone Alert */}
      {isOutsideSafeZone ? (
        <Alert variant="destructive" className="mx-6 mt-4 border-destructive/50 bg-destructive/10 animate-pulse">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="font-bold">Cảnh báo: Ra khỏi vùng an toàn!</AlertTitle>
          <AlertDescription>
            Vị trí hiện tại cách vùng an toàn {Math.round(distanceFromCenter - radiusInMeters)} mét. 
            Vui lòng quay lại khu vực an toàn.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="mx-6 mt-4 border-primary/50 bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
          <AlertTitle className="font-bold text-primary">Trong vùng an toàn</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Vị trí hiện tại nằm trong bán kính an toàn ({radiusInMeters}m).
          </AlertDescription>
        </Alert>
      )}
      
      <div className="relative h-[400px] mt-4">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={15}
            options={{
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: true,
              zoomControl: true,
            }}
          >
            {/* Current position marker */}
            <Marker 
              position={center}
              icon={currentPositionIcon}
            />
            
            {/* Safe zone center marker */}
            {(safeCenterLat !== undefined || safeCenterLng !== undefined) && safeCenterIcon && (
              <Marker 
                position={safeCenter}
                icon={safeCenterIcon}
              />
            )}
            
            {/* Safe zone circle */}
            <Circle
              center={safeCenter}
              radius={radiusInMeters}
              options={{
                fillColor: isOutsideSafeZone ? "#ef4444" : "#22c55e",
                fillOpacity: 0.2,
                strokeColor: isOutsideSafeZone ? "#ef4444" : "#22c55e",
                strokeOpacity: 0.8,
                strokeWeight: 2,
              }}
            />
          </GoogleMap>
        ) : (
          <div className="flex items-center justify-center h-full bg-muted/50">
            <div className="text-muted-foreground">Đang tải bản đồ...</div>
          </div>
        )}
      </div>
      
      <div className="p-6 space-y-2 border-t border-border bg-card">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-destructive" />
          <span className="font-medium text-foreground">Vị trí:</span>
          <span className="text-muted-foreground">
            {useRealtimeGPS && geoLocation.latitude && geoLocation.longitude
              ? `${geoLocation.latitude.toFixed(6)}, ${geoLocation.longitude.toFixed(6)}`
              : position}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Bán kính vùng an toàn:</span>
          <span className="text-muted-foreground">{safeRadius}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className={`h-4 w-4 ${isOutsideSafeZone ? 'text-destructive' : 'text-primary'}`} />
          <span className="font-medium text-foreground">Khoảng cách từ tâm:</span>
          <span className={isOutsideSafeZone ? 'text-destructive font-semibold' : 'text-muted-foreground'}>
            {Math.round(distanceFromCenter)} mét
          </span>
        </div>
        {useRealtimeGPS && geoLocation.speed !== null && geoLocation.speed > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Navigation className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Tốc độ:</span>
            <span className="text-muted-foreground">
              {(geoLocation.speed * 3.6).toFixed(1)} km/h
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapSection;
