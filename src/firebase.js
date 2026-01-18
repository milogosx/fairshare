import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove } from 'firebase/database';

const firebaseConfig = {
apiKey: "AIzaSyBnmc5dnYkxPvDG7tV3Gvx-n_AH3oDbvX8",
authDomain: "[fairsharegroup-61387.firebaseapp.com](http://fairsharegroup-61387.firebaseapp.com/)",
projectId: "fairsharegroup-61387",
storageBucket: "fairsharegroup-61387.firebasestorage.app",
messagingSenderId: "200281376262",
appId: "1:200281376262:web:9b5c1e594a4cf129e1a587"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export const storage = {
  async get(key, shared = false) {
    const dbRef = ref(database, `receipts/${key}`);
    const snapshot = await get(dbRef);
    if (snapshot.exists()) {
      return { key, value: snapshot.val(), shared };
    }
    return null;
  },

  async set(key, value, shared = false) {
    const dbRef = ref(database, `receipts/${key}`);
    await set(dbRef, value);
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    const dbRef = ref(database, `receipts/${key}`);
    await remove(dbRef);
    return { key, deleted: true, shared };
  },

  async list(prefix = '', shared = false) {
    const dbRef = ref(database, 'receipts');
    const snapshot = await get(dbRef);
    if (snapshot.exists()) {
      const data = snapshot.val();
      const keys = Object.keys(data).filter(k => k.startsWith(prefix));
      return { keys, prefix, shared };
    }
    return { keys: [], prefix, shared };
  }
};
