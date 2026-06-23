import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { defaultYouTube } from "./firebase-config.js";

const SITE_SETTINGS_DOC = doc(db, "siteSettings", "main");
const ABOUT_DOC = doc(db, "about", "main");

export async function getSiteSettings() {
  const snap = await getDoc(SITE_SETTINGS_DOC);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return {
    churchName: "BEM On The Rock",
    tagline: "Building lives on the solid foundation of Christ",
    youtubeChannelUrl: defaultYouTube.channelUrl,
    youtubeLiveUrl: defaultYouTube.liveUrl,
    address: "",
    phone: "",
    email: "",
    serviceTimes: "Sundays at 10:00 AM",
  };
}

export async function saveSiteSettings(data) {
  await setDoc(
    SITE_SETTINGS_DOC,
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getAboutContent() {
  const snap = await getDoc(ABOUT_DOC);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return {
    history:
      "BEM On The Rock was founded with a vision to build lives on the unshakeable foundation of Jesus Christ. Our congregation gathers to worship, grow, and serve our community together.",
    mission:
      "To lead people into a growing relationship with Jesus Christ through worship, discipleship, and community outreach.",
    vision:
      "A church family rooted in faith, reaching the lost, and transforming lives for the glory of God.",
    values:
      "Faith · Love · Integrity · Community · Service",
    contactNote:
      "We welcome visitors and newcomers. Come as you are — you belong here.",
  };
}

export async function saveAboutContent(data) {
  await setDoc(
    ABOUT_DOC,
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getNews() {
  const q = query(collection(db, "news"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createNews(data) {
  const ref = await addDoc(collection(db, "news"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateNews(id, data) {
  await updateDoc(doc(db, "news", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNews(id) {
  await deleteDoc(doc(db, "news", id));
}

export async function getUpdates() {
  const q = query(collection(db, "updates"), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createUpdate(data) {
  const ref = await addDoc(collection(db, "updates"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateUpdate(id, data) {
  await updateDoc(doc(db, "updates", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteUpdate(id) {
  await deleteDoc(doc(db, "updates", id));
}

/** Format Firestore timestamp or ISO string for display */
export function formatDate(value) {
  if (!value) return "";
  let date;
  if (value.toDate) {
    date = value.toDate();
  } else {
    date = new Date(value);
  }
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
