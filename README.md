# BEM On The Rock — Church Website

A static church website for **BEM On The Rock** with Firebase-powered content management, dark/light mode, and YouTube livestream integration.

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `index.html` | Livestream, updates, and news |
| About | `about.html` | Church history, mission, vision (editable) |
| Admin | `admin.html` | Staff login and CRUD dashboard |

## File Structure

```
css/styles.css          — Single stylesheet (marigold theme + dark/light mode)
js/firebase-config.js   — Firebase API keys and project credentials
js/firebase-init.js     — Firebase app initialization
js/firebase-service.js  — Firestore CRUD operations
js/theme.js             — Dark/light mode toggle
js/common.js            — Shared utilities
js/index.js             — Home page logic
js/about.js             — About page logic
js/admin.js             — Admin dashboard + auth
firestore.rules           — Firestore security rules
```

## Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/).
2. Enable **Authentication** → Email/Password sign-in.
3. Create an admin user under Authentication → Users.
4. Enable **Cloud Firestore** (start in production mode).
5. Copy your web app config into `js/firebase-config.js`:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

6. Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

Or paste the contents of `firestore.rules` into the Firebase Console → Firestore → Rules.

## Running Locally

Serve the folder with any static file server (required for ES modules):

```bash
npx serve .
```

Then open `http://localhost:3000`.

## Admin Usage

1. Go to `/admin.html` and sign in with your Firebase admin account.
2. Use the sidebar to manage:
   - **News** — Articles on the home page
   - **Updates** — Announcements and ongoing activities
   - **About Page** — History, mission, vision, values
   - **Site Settings** — Church name, YouTube links, contact info, service times

## YouTube Livestream

In **Site Settings**, set:

- **YouTube Live URL** — Direct link to the live stream (e.g. `https://www.youtube.com/@YourChannel/live`)
- **YouTube Channel URL** — Your channel page
- **YouTube Video ID** (optional) — Embeds a video on the home page

## Theme

- Primary colour: Pantone Marigold (`#FAA61A`)
- Secondary: black (light mode) / white (dark mode)
- Toggle via the moon/sun button in the header (saved in `localStorage`)
