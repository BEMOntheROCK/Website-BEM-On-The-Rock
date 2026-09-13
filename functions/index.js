/**
 * Cloud Functions for BEM On The ROCK.
 *
 * Five functions:
 *   - onNewsCreated / onUpdateCreated — Firestore triggers that fire
 *     whenever the admin panel creates a new News or Update, sending a
 *     push notification to every device that has opted in (stored in the
 *     "pushTokens" collection by js/notifications.js).
 *   - onNewsDeleted / onUpdateDeleted — companion triggers that remove the
 *     matching entry from "notificationLog" when the News/Update it was
 *     about gets deleted, so the bell dropdown doesn't keep pointing at
 *     content that no longer exists.
 *   - checkLiveStatus — runs on a schedule (every 5 minutes), checks
 *     whether the church's YouTube channel is currently live via the
 *     YouTube Data API, caches the result (and the live video's ID) in
 *     Firestore at liveStatus/main — which the homepage reads directly
 *     to drive the "Live" badge and player. Sends a "We're live!"
 *     notification on the false → true transition (not on every check
 *     while already live), and removes that same notification on the
 *     true → false transition, once the stream actually ends.
 *   - cleanupNotificationLog — runs once a day, deleting any
 *     notificationLog entry older than 7 days. This is the only cap on
 *     how much notification history accumulates — there's no longer a
 *     fixed count limit, so the bell dropdown shows everything from the
 *     last 7 days, however many that is.
 *
 * Deploy with:  firebase deploy --only functions
 * (requires the Firebase CLI: npm install -g firebase-tools, then
 * firebase login, run once from the repo root)
 *
 * checkLiveStatus additionally requires a YouTube Data API key stored as
 * a Cloud Functions secret — see the setup steps discussed with Claude,
 * or run: firebase functions:secrets:set YOUTUBE_API_KEY
 */

const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
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
async function sendToAllSubscribers({ title, body, url, source }) {
  // Logged unconditionally — the bell dropdown's history should reflect
  // every announcement that went out, regardless of whether anyone had
  // push enabled yet at the time.
  const notificationId = await logNotification({ title, body, url: url || "/index.html", source });

  const tokensSnap = await db.collection("pushTokens").get();
  const tokens = tokensSnap.docs.map((doc) => doc.id);

  if (tokens.length === 0) {
    console.log("No subscribed devices — skipping notification send.");
    return notificationId;
  }

  // Deliberately data-only, no top-level "notification" field. When a
  // push payload includes "notification", browsers automatically display
  // their own generic notification for it *in addition to* whatever our
  // own onBackgroundMessage handler shows (see firebase-messaging-sw.js)
  // — this is documented Firebase/browser behavior, not a bug in our
  // code, but it means every message was showing up twice: once as the
  // browser's automatic, uncustomizable version (hence the plain generic
  // icon), and once as our own properly-formatted one. Data-only messages
  // skip that automatic display entirely, leaving our handler as the only
  // thing that ever shows a notification.
  const message = {
    data: { title, body, url: url || "/index.html" },
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

  return notificationId;
}

/**
 * Records what was actually sent, for the bell dropdown's "recent
 * notifications" list. There's no per-visitor account here, so this is a
 * single shared history for everyone, not a personal inbox — the client
 * separately tracks a per-device "last viewed" timestamp (in
 * localStorage) to know what counts as unread for that specific visitor.
 *
 * `source`, when given, is `{ collection: "news" | "updates" | "live", id }`
 * — a reference back to whatever triggered this notification, so it can
 * be found and removed later if that content is deleted (see
 * onNewsDeleted/onUpdateDeleted) or, for a livestream, once the stream
 * ends (see checkLiveStatus). Returns the new doc's ID.
 *
 * There's no count-based cap here — cleanupNotificationLog handles
 * pruning on a 7-day time basis instead, so an entry sticks around for a
 * predictable length of time regardless of how many other notifications
 * get sent around it.
 */
async function logNotification({ title, body, url, source }) {
  const ref = await db.collection("notificationLog").add({
    title,
    body,
    url,
    source: source || null,
    sentAt: new Date().toISOString(),
  });
  return ref.id;
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
    url: "/index.html#news",
    source: { collection: "news", id: event.params.docId },
  });
});

exports.onUpdateCreated = onDocumentCreated("updates/{docId}", async (event) => {
  const update = event.data?.data();
  if (!update) return;

  await sendToAllSubscribers({
    title: update.title || "New update",
    body: excerpt(update.content),
    url: "/index.html#updates",
    source: { collection: "updates", id: event.params.docId },
  });
});

/**
 * Removes every notificationLog entry whose `source` points at the given
 * collection/doc — normally just one, but a find-and-delete-all approach
 * costs nothing extra and stays correct even if that were ever not true.
 */
async function deleteNotificationsForSource(collection, id) {
  const snap = await db
    .collection("notificationLog")
    .where("source.collection", "==", collection)
    .where("source.id", "==", id)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
}

exports.onNewsDeleted = onDocumentDeleted("news/{docId}", async (event) => {
  await deleteNotificationsForSource("news", event.params.docId);
});

exports.onUpdateDeleted = onDocumentDeleted("updates/{docId}", async (event) => {
  await deleteNotificationsForSource("updates", event.params.docId);
});

/**
 * Asks the YouTube Data API whether the given channel currently has a
 * live broadcast in progress. Returns { live, videoId } — never throws;
 * any error is logged and treated as "not live" so a transient API
 * hiccup doesn't send a false notification or show a broken embed.
 */
async function checkChannelLive(channelId, apiKey) {
  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?part=snippet&channelId=${channelId}&eventType=live&type=video&key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`YouTube API error: ${response.status} ${await response.text()}`);
      return { live: false, videoId: null };
    }
    const data = await response.json();
    const item = Array.isArray(data.items) ? data.items[0] : null;
    return { live: !!item, videoId: item?.id?.videoId || null };
  } catch (err) {
    console.error("YouTube API request failed:", err);
    return { live: false, videoId: null };
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
    const liveNotificationId = statusSnap.data()?.liveNotificationId || null;

    const { live: isLiveNow, videoId } = await checkChannelLive(channelId, youtubeApiKey.value());

    await statusRef.set(
      { isLive: isLiveNow, videoId: videoId || null, checkedAt: new Date().toISOString() },
      { merge: true }
    );

    // Only notify on the false → true transition, so we don't send a
    // fresh notification every 5 minutes for the whole duration of a
    // single service. The new notification's ID is stashed on this same
    // doc so the true → false transition below can find and remove it
    // once the stream actually ends.
    if (isLiveNow && !wasLive) {
      const newNotificationId = await sendToAllSubscribers({
        title: "We're live!",
        body: "Join the Sunday service livestream now.",
        url: "/index.html#livestream",
        source: { collection: "live" },
      });
      await statusRef.set({ liveNotificationId: newNotificationId }, { merge: true });
    } else if (!isLiveNow && wasLive && liveNotificationId) {
      await db.collection("notificationLog").doc(liveNotificationId).delete();
      await statusRef.set({ liveNotificationId: null }, { merge: true });
    }
  }
);

const NOTIFICATION_LOG_MAX_AGE_DAYS = 7;

/**
 * Runs once a day, deleting any notificationLog entry older than
 * NOTIFICATION_LOG_MAX_AGE_DAYS. This is the only cap on how much
 * notification history accumulates — the bell dropdown shows everything
 * within that window, however many that is.
 */
exports.cleanupNotificationLog = onSchedule("every 24 hours", async () => {
  const cutoff = new Date(Date.now() - NOTIFICATION_LOG_MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const snap = await db.collection("notificationLog").where("sentAt", "<", cutoff).get();
  if (snap.empty) return;

  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Removed ${snap.size} notification(s) older than ${NOTIFICATION_LOG_MAX_AGE_DAYS} days.`);
});