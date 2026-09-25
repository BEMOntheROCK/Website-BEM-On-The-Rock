# BEM On The Rock — Church Website

A static church website for **BEM On The Rock** with Firebase-powered content management, dark/light mode, and YouTube livestream integration.

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Home | `index.html` | Livestream, updates, and news |
| About | `public/about.html` | Mission, vision, values (editable) |
| History | `public/history.html` | Church history articles with images |
| Admin | `admin/admin.html` | Staff login and CRUD dashboard |

## File Structure

```
css/styles.css          — Single stylesheet (marigold theme + dark/light mode)
js/firebase-config.js   — Firebase API keys and project credentials
js/firebase-init.js     — Firebase app initialization
js/firebase-service.js  — Firestore CRUD operations
js/image-compress.js  — Client-side compression (8 MB → ~800 KB)
js/image-service.js   — Upload/retrieve images in Firestore media collection
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

### Firebase deployment prerequisites

The `deploy-functions` GitHub Actions job deploys Cloud Functions, Firestore rules, and Storage rules to the Google Cloud project `website-bem-on-the-rock`. Complete these one-time steps in the [Google Cloud Console](https://console.cloud.google.com/):

1. Select `website-bem-on-the-rock` and link an active billing account under **Billing**. Cloud Functions deployments that use Secret Manager require billing to be enabled, even when the application itself has low usage.
2. Under **APIs & Services → Library**, enable these APIs:
  - Firebase Management API
  - Service Usage API
  - Cloud Functions API
  - Cloud Build API
  - Artifact Registry API
  - Cloud Run Admin API
  - Eventarc API
  - Cloud Scheduler API
  - Secret Manager API

The same API step can be run with Google Cloud CLI after selecting the project:

```bash
gcloud services enable \
  firebase.googleapis.com \
  serviceusage.googleapis.com \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  eventarc.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  --project=website-bem-on-the-rock
```
3. Create the YouTube API key as a Firebase-managed secret. This command prompts for the value locally; the value must never be committed or added to a workflow file:

```bash
firebase functions:secrets:set YOUTUBE_API_KEY --project website-bem-on-the-rock
```

4. Add `FIREBASE_TOKEN` under **GitHub repository Settings → Secrets and variables → Actions**. Generate it locally with `firebase login:ci`; do not place the token in the repository.

The workflow validates `FIREBASE_TOKEN` separately from the Firebase deployment. If deployment reports that billing is required or an API is disabled, the Google Cloud project setup above must be completed manually; repository code cannot enable billing.

## Running Locally

Serve the folder with any static file server (required for ES modules):

```bash
npx serve .
```

Then open `http://localhost:3000`.

## Images

Admins can upload images (max **8 MB**) for news, updates, history articles, hero backgrounds, and about sections. Images are compressed client-side to ~**800 KB** before being stored in the Firestore `media` collection (Spark-plan friendly).

Logo and favicon are hard-coded in the site files and are not managed via admin.

## Admin Usage

1. Go to `/admin/admin.html` and sign in with your Firebase admin account.
2. Use the sidebar to manage:
   - **News** — Articles on the home page (with optional image)
   - **Updates** — Announcements (with optional image)
   - **History** — Timeline articles on the History page (with optional image)
   - **About Page** — Mission, vision, values, and section images
   - **Site Settings** — Church name, YouTube links, contact info, hero background

## YouTube Livestream

In **Site Settings**, set:

- **YouTube Live URL** — Direct link to the live stream (e.g. `https://www.youtube.com/@YourChannel/live`)
- **YouTube Channel URL** — Your channel page
- **YouTube Video ID** (optional) — Embeds a video on the home page

## Theme

- Primary colour: Pantone Marigold (`#FAA61A`)
- Secondary: black (light mode) / white (dark mode)
- Toggle via the moon/sun button in the header (saved in `localStorage`)
