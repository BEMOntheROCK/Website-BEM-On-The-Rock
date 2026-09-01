/**
 * Firebase Cloud Messaging background handler.
 *
 * This file MUST be named exactly "firebase-messaging-sw.js" and MUST live
 * at the site root — the Firebase Messaging SDK looks for it at this exact
 * path by default when a page calls getToken().
 *
 * It's a separate, classic (non-module) service worker from our main
 * service-worker.js, and only handles background push notifications — it
 * does not do any of the page caching that service-worker.js does.
 *
 * The config values below are the same ones used in js/firebase-config.js —
 * they are NOT secret (Firebase's own docs confirm this: these values are
 * already visible in every request your site makes to Firebase, the same
 * way a mailing address isn't a secret just because it's specific to you).
 * This file can't use our config.js template/placeholder swap because
 * service workers using importScripts() can't import ES modules, so the
 * values are duplicated here directly.
 */

importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCeUIxa5qBUuxDuTEa04IaBefFpWDHHMZM",
  authDomain: "website-bem-on-the-rock.firebaseapp.com",
  projectId: "website-bem-on-the-rock",
  storageBucket: "website-bem-on-the-rock.firebasestorage.app",
  messagingSenderId: "1022431655269",
  appId: "1:1022431655269:web:d45142f2e39526f5c21d8c",
});

const messaging = firebase.messaging();

// Shown when a push arrives while the site/app isn't in focus.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "BEM On The ROCK";
  const options = {
    body: payload.notification?.body || "",
    icon: "assets/icons/icon-192.png",
    badge: "assets/icons/icon-192.png",
    data: { url: payload.data?.url || "/index.html" },
  };
  self.registration.showNotification(title, options);
});

// Clicking the notification focuses an existing tab if one's open, or opens
// a new one, landing on whatever URL the sender specified (defaults home).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/index.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});