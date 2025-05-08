import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';


const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

console.log(firebaseConfig);

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// You can export the initialized services to use them throughout your app
export { auth };
// export { auth, db }; // If you initialized Firestore too
