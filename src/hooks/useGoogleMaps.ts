import { useJsApiLoader } from "@react-google-maps/api";

const GOOGLE_MAPS_API_KEY = "AIzaSyBU3WWXp224gFPC63J-C5NydncuGeMjd4E";

export const useGoogleMaps = () => {
  return useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });
};

export { GOOGLE_MAPS_API_KEY };
