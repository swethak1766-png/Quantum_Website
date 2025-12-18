import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, inMemoryPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBmPBEL8RkLA6o3YZN4Roxk1ajgpMz4m08",
  authDomain: "quantum-50bf2.firebaseapp.com",
  projectId: "quantum-50bf2",
  storageBucket: "quantum-50bf2.appspot.com",
  messagingSenderId: "147009115579",
  appId: "1:147009115579:web:7d7d80a544c2942e85a09e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 👇 This makes login session last ONLY in memory
setPersistence(auth, inMemoryPersistence);

export { auth };
