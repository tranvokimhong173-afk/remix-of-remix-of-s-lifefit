import { ref, set, get } from "firebase/database";
import { database } from "@/lib/firebase";

export interface SafeZoneConfig {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
}

export interface UserProfile {
  name: string;
  age: number;
  email: string;
  gender: "male" | "female" | "other";
  conditions: {
    cardiovascular: boolean;
    diabetes: boolean;
    hypertension: boolean;
    respiratory: boolean;
  };
  safeZone?: SafeZoneConfig;
  emergencyContact?: string; // Phone number for emergency SMS
  last_updated: string;
}

export const saveUserProfile = async (userId: string, profileData: Omit<UserProfile, "last_updated">) => {
  const userProfileRef = ref(database, `userProfile/${userId}`);
  
  const profile: UserProfile = {
    ...profileData,
    last_updated: new Date().toISOString(),
  };

  await set(userProfileRef, profile);
  return profile;
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  const userProfileRef = ref(database, `userProfile/${userId}`);
  const snapshot = await get(userProfileRef);
  
  if (snapshot.exists()) {
    return snapshot.val() as UserProfile;
  }
  
  return null;
};
