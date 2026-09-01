/**
 * Cloud Functions for BEM On The ROCK.
 *
 * Two Firestore triggers — one for the "news" collection, one for
 * "updates" — fire whenever the admin panel creates a new document in
 * either. Each one sends a push notification to every device that has
 * opted in (stored in the "pushTokens" collection by js/notifications.js).
 *
 * Deploy with:  firebase deploy --only functions
 * (requires the Firebase CLI: npm install -g firebase-tools, then
 * firebase login, run once from the repo root)
 */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

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