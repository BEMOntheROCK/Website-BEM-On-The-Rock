/**
 * Firebase configuration TEMPLATE for BEM On The ROCK
 *
 * This file is safe to commit — it contains no real credentials.
 * __FIREBASE_API_KEY__ gets swapped for the real key at deploy time by
 * the GitHub Actions workflow (.github/workflows/deploy.yml), which reads
 * it from the FIREBASE_API_KEY repository secret.
 *
 * For local development: copy this file to firebase-config.js (same
 * folder) and replace __FIREBASE_API_KEY__ with your real key. That copy
 * is gitignored, so it never gets committed.
 */
export const firebaseConfig = {
  apiKey: "__FIREBASE_API_KEY__",
  authDomain: "website-bem-on-the-rock.firebaseapp.com",
  projectId: "website-bem-on-the-rock",
  storageBucket: "website-bem-on-the-rock.firebasestorage.app",
  messagingSenderId: "1022431655269",
  appId: "1:1022431655269:web:d45142f2e39526f5c21d8c",
  measurementId: "G-Q71YBM72P4"
};

/** Default YouTube links — admins can override these in the dashboard */
export const defaultYouTube = {
  channelUrl: "https://www.youtube.com/@bem_ontherock",
  liveUrl: "https://www.youtube.com/@bem_ontherock/live",
  channelId: "UCokmjLYT92F1EDik5Gvx8Kw",
};