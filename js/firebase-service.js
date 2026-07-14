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
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { db } from "./firebase-init.js";
import { defaultYouTube } from "./firebase-config.js";

const SITE_SETTINGS_DOC = doc(db, "siteSettings", "main");
const ABOUT_DOC = doc(db, "about", "main");
const ORG_DOC = doc(db, "organisation", "main");

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

const DEFAULT_ABOUT = {
  fullName: "BEM On The Rock",
  denomination: "",
  registrationNumber: "",
  officeHours: "",
  whatsapp: "",
  officePhone: "",
  officePhoneLink: "",
  instagram: "",
  facebook: "",
  emailAdmin: "",
  emailAccount: "",
  youtubeSocial: "",
  founderName: "",
  founderBio: "",
  founderImageId: null,
  mission:
    "To lead people into a growing relationship with Jesus Christ through worship, discipleship, and community outreach.",
  vision:
    "A church family rooted in faith, reaching the lost, and transforming lives for the glory of God.",
  values: "Faith · Love · Integrity · Community · Service",
  contactNote:
    "We welcome visitors and newcomers. Come as you are — you belong here.",
  heroImageId: null,
  missionImageId: null,
  visionImageId: null,
  valuesImageId: null,
};

export async function getAboutContent() {
  const snap = await getDoc(ABOUT_DOC);
  if (snap.exists()) {
    return { ...DEFAULT_ABOUT, id: snap.id, ...snap.data() };
  }
  return { ...DEFAULT_ABOUT };
}

export async function saveAboutContent(data) {
  await setDoc(
    ABOUT_DOC,
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function getOrgStructure() {
  const snap = await getDoc(ORG_DOC);
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() };
  }
  return { chartImageId: null };
}

export async function saveOrgStructure(data) {
  await setDoc(
    ORG_DOC,
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ── Categories ──

export async function getCategories() {
  const snap = await getDocs(
    query(collection(db, "categories"), orderBy("order", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCategory(data) {
  return addDoc(collection(db, "categories"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateCategory(id, data) {
  return updateDoc(doc(db, "categories", id), data);
}

export async function deleteCategory(id) {
  return deleteDoc(doc(db, "categories", id));
}

/**
 * Persist a full reordered categories array in a single batch write.
 * Each item must have { id, ...fields }.
 */
export async function saveCategories(categories) {
  const batch = writeBatch(db);
  categories.forEach((cat, i) => {
    batch.update(doc(db, "categories", cat.id), { order: i });
  });
  return batch.commit();
}

// ── Carousel Videos ──

export async function getCarouselVideos() {
  const q = query(collection(db, "carouselVideos"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCarouselVideo(data) {
  const ref = await addDoc(collection(db, "carouselVideos"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCarouselVideo(id, data) {
  await updateDoc(doc(db, "carouselVideos", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCarouselVideo(id) {
  await deleteDoc(doc(db, "carouselVideos", id));
}

export async function saveCarouselVideosOrder(videos) {
  const batch = writeBatch(db);
  videos.forEach((v, i) => {
    batch.update(doc(db, "carouselVideos", v.id), { order: i });
  });
  return batch.commit();
}

// ── Activities Categories ──

export async function getActivitiesCategories() {
  const snap = await getDocs(
    query(collection(db, "activitiesCategories"), orderBy("order", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createActivitiesCategory(data) {
  return addDoc(collection(db, "activitiesCategories"), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export async function updateActivitiesCategory(id, data) {
  return updateDoc(doc(db, "activitiesCategories", id), data);
}

export async function deleteActivitiesCategory(id) {
  return deleteDoc(doc(db, "activitiesCategories", id));
}

export async function saveActivitiesCategories(categories) {
  const batch = writeBatch(db);
  categories.forEach((cat, i) => {
    batch.update(doc(db, "activitiesCategories", cat.id), { order: i });
  });
  return batch.commit();
}

// ── Activities ──

export async function getActivities() {
  const q = query(collection(db, "activities"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createActivity(data) {
  const ref = await addDoc(collection(db, "activities"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateActivity(id, data) {
  await updateDoc(doc(db, "activities", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteActivity(id) {
  await deleteDoc(doc(db, "activities", id));
}

// ── Leaders ──

export async function getLeaders() {
  const q = query(collection(db, "leaders"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createLeader(data) {
  const ref = await addDoc(collection(db, "leaders"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLeader(id, data) {
  await updateDoc(doc(db, "leaders", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteLeader(id) {
  await deleteDoc(doc(db, "leaders", id));
}

/** Derive a numeric sort key from free-text or ISO dates */
export function parseSortKey(value) {
  if (!value) return 0;
  if (value.toDate) return value.toDate().getTime();
  if (typeof value === "number") return value;

  const text = String(value).trim();
  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) return parsed;

  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) return parseInt(yearMatch[0], 10) * 1e10;

  return 0;
}

export function sortHistoryItems(items, direction = "desc") {
  const dir = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const keyA = a.sortKey ?? parseSortKey(a.date);
    const keyB = b.sortKey ?? parseSortKey(b.date);
    if (keyA !== keyB) return (keyA - keyB) * dir;

    const createdA = a.createdAt?.seconds ?? 0;
    const createdB = b.createdAt?.seconds ?? 0;
    return (createdA - createdB) * dir;
  });
}

export async function getHistory(direction = "desc") {
  const snap = await getDocs(collection(db, "history"));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortHistoryItems(items, direction);
}

export async function createHistory(data) {
  const date = data.date?.trim() ?? "";
  const ref = await addDoc(collection(db, "history"), {
    ...data,
    date,
    sortKey: parseSortKey(date),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateHistory(id, data) {
  const date = data.date?.trim() ?? "";
  await updateDoc(doc(db, "history", id), {
    ...data,
    date,
    sortKey: parseSortKey(date),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteHistory(id) {
  await deleteDoc(doc(db, "history", id));
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
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Display history date — plain text or formatted ISO */
export function displayHistoryDate(value) {
  if (!value) return "";
  if (typeof value === "string" && Number.isNaN(Date.parse(value))) {
    return value;
  }
  return formatDate(value);
}