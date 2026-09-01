/**
 * Cloud Functions for BEM On The ROCK.
 *
 * Three functions:
 *   - onNewsCreated / onUpdateCreated — Firestore triggers that fire
 *     whenever the admin panel creates a new News or Update, sending a
 *     push notification to every device that has opted in (stored in the
 *     "pushTokens" collection by js/notifications.js).
 *   - checkLiveStatus — runs on a schedule (every 5 minutes), checks
 *     whether the church's YouTube channel is currently live, and sends a
 *     "We're live!" notification the moment it detects the stream just
 *     started (not on every check while already live).
 *
 * Deploy with:  firebase deploy --only functions
 * (requires the Firebase CLI: npm install -g firebase-tools, then
 * firebase login, run once from the repo root)
 *
 * checkLiveStatus additionally requires a YouTube Data API key stored as
 * a Cloud Functions secret — see the setup steps discussed with Claude,
 * or run: firebase functions:secrets:set YOUTUBE_API_KEY
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

const youtubeApiKey = defineSecret("YOUTUBE_API_KEY");
const DEFAULT_CHANNEL_ID = "UCokmjLYT92F1EDik5Gvx8Kw";

/**
 * Fetches every saved push token, sends the notification to all of them in
 * batches (FCM allows at most 500 tokens per call), and removes any tokens
 * that have expired or been revoked (e.g. the visitor uninstalled the app
 * or cleared their browser data) so the list doesn't grow stale forever.
 */
async function sendToAllSubscribers({ title, body, url }) {
  const tokensSnap = await db.collection("pushTokens").get();
  const tokens = tokensSnap.docs.map((doc) => doc.id);

  if (tokens.length === 0) {
    console.log("No subscribed devices — skipping notification send.");
    return;
  }

  const message = {
    notification: { title, body },
    data: { url: url || "/index.html" },
  };

  const staleTokens = [];
  const BATCH_SIZE = 500;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const response = await messaging.sendEachForMulticast({
      ...message,
      tokens: batch,
    });

    response.responses.forEach((result, index) => {
      if (!result.success) {
        const code = result.error?.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          staleTokens.push(batch[index]);
        }
      }
    });
  }

  if (staleTokens.length > 0) {
    const cleanupBatch = db.batch();
    staleTokens.forEach((token) => {
      cleanupBatch.delete(db.collection("pushTokens").doc(token));
    });
    await cleanupBatch.commit();
    console.log(`Removed ${staleTokens.length} stale push token(s).`);
  }

  console.log(`Notification sent to ${tokens.length - staleTokens.length} device(s).`);
}

function excerpt(text, maxLength = 120) {
  if (!text) return "";
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

exports.onNewsCreated = onDocumentCreated("news/{docId}", async (event) => {
  const news = event.data?.data();
  if (!news) return;

  await sendToAllSubscribers({
    title: news.title || "New announcement",
    body: excerpt(news.content),
    url: "/index.html",
  });
});

exports.onUpdateCreated = onDocumentCreated("updates/{docId}", async (event) => {
  const update = event.data?.data();
  if (!update) return;

  await sendToAllSubscribers({
    title: update.title || "New update",
    body: excerpt(update.content),
    url: "/index.html",
  });
});

/**
 * Asks the YouTube Data API whether the given channel currently has a
 * live broadcast in progress. Returns true/false — never throws; any
 * error is logged and treated as "not live" so a transient API hiccup
 * doesn't send a false notification.
 */
async function isChannelLive(channelId, apiKey) {
  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`YouTube API error: ${response.status} ${await response.text()}`);
      return false;
    }
    const data = await response.json();
    return Array.isArray(data.items) && data.items.length > 0;
  } catch (err) {
    console.error("YouTube API request failed:", err);
    return false;
  }
}

const LIVE_STATUS_DOC = "liveStatus/main";

exports.checkLiveStatus = onSchedule(
  { schedule: "every 5 minutes", secrets: [youtubeApiKey] },
  async () => {
    const settingsSnap = await db.doc("siteSettings/main").get();
    const channelId = settingsSnap.data()?.youtubeChannelId || DEFAULT_CHANNEL_ID;

    const statusRef = db.doc(LIVE_STATUS_DOC);
    const statusSnap = await statusRef.get();
    const wasLive = statusSnap.data()?.isLive === true;

    const isLiveNow = await isChannelLive(channelId, youtubeApiKey.value());

    await statusRef.set(
      { isLive: isLiveNow, checkedAt: new Date().toISOString() },
      { merge: true }
    );

    // Only notify on the false → true transition, so we don't send a
    // fresh notification every 5 minutes for the whole duration of a
    // single service.
    if (isLiveNow && !wasLive) {
      await sendToAllSubscribers({
        title: "We're live!",
        body: "Join the Sunday service livestream now.",
        url: "/index.html",
      });
    }
  }
);