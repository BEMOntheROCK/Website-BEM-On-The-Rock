/**
 * Firebase configuration for BEM On The Rock
 *
 * Replace the placeholder values below with your project credentials
 * from the Firebase Console: Project Settings → General → Your apps
 */
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

/** Default YouTube links — admins can override these in the dashboard */
export const defaultYouTube = {
  channelUrl: "https://www.youtube.com/@BEMOnTheRock",
  liveUrl: "https://www.youtube.com/@BEMOnTheRock/live",
};
