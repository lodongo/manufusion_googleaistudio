
// Use compat imports for Firebase v9+ to support v8 syntax.
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";

// In production, move these to env vars
export const firebaseConfig = {
  apiKey: "AIzaSyCzbQQObL66vqEFInZu2bZYQ8Ej7xIcrks",
  authDomain: "mems-92373.firebaseapp.com",
  projectId: "mems-92373",
  storageBucket: "mems-92373.appspot.com",
  messagingSenderId: "873845023293",
  appId: "1:873845023293:web:55f0715cfb4bffcd250054",
  measurementId: "G-Y26GT3YS8Y",
};

// Use v8 syntax to initialize app.
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// Initialize Firestore
// Use v8 syntax to get firestore instance.
const db = firebase.firestore();

// Enable multi-tab persistence
// Use v8 syntax for multi-tab persistence.
firebase.firestore().enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // A persistence-enabled tab already exists
      console.warn('Firebase persistence failed: another tab may be open.');
    } else if (err.code === 'unimplemented') {
      // The browser doesn't support persistence
      console.warn('Firebase persistence is not available in this browser.');
    } else {
        console.error("Firebase persistence error: ", err);
    }
  });

// Use v8 syntax to get auth and storage instances.
const auth = firebase.auth();
const storage = firebase.storage();

export { db, auth, storage };