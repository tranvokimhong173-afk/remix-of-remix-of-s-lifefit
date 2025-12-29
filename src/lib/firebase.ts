import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBU3WWXp224gFPC63J-C5NydncuGeMjd4E",
  authDomain: "caretrack-1338f.firebaseapp.com",
  databaseURL: "https://caretrack-1338f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "caretrack-1338f",
  storageBucket: "caretrack-1338f.firebasestorage.app",
  messagingSenderId: "528131120569",
  appId: "1:528131120569:web:3bd115886120c93a17ea68",
  measurementId: "G-5P99CLW0QK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Get a reference to the database service
export const database = getDatabase(app);
export const firestore = getFirestore(app);
