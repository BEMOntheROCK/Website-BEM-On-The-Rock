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
const COMMUNITY_DOC = doc(db, "community", "main");

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

// ── Community Contributions (intro text) ──

const DEFAULT_COMMUNITY = {
  introText: "",
};

export async function getCommunityContent() {
  const snap = await getDoc(COMMUNITY_DOC);
  if (snap.exists()) {
    return { ...DEFAULT_COMMUNITY, id: snap.id, ...snap.data() };
  }
  return { ...DEFAULT_COMMUNITY };
}

export async function saveCommunityContent(data) {
  await setDoc(
    COMMUNITY_DOC,
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ── Community Contributions (photo collage) ──

export async function getCommunityPhotos() {
  const snap = await getDocs(
    query(collection(db, "communityPhotos"), orderBy("order", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createCommunityPhoto(data) {
  const ref = await addDoc(collection(db, "communityPhotos"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCommunityPhoto(id, data) {
  await updateDoc(doc(db, "communityPhotos", id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommunityPhoto(id) {
  await deleteDoc(doc(db, "communityPhotos", id));
}

export async function saveCommunityPhotosOrder(photos) {
  const batch = writeBatch(db);
  photos.forEach((p, i) => {
    batch.update(doc(db, "communityPhotos", p.id), { order: i });
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

const MONTH_NAMES = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const MONTH_INDEX = { january:1, jan:1, february:2, feb:2, march:3, mar:3, april:4, apr:4, may:5, june:6, jun:6, july:7, jul:7, august:8, aug:8, september:9, sep:9, sept:9, october:10, oct:10, november:11, nov:11, december:12, dec:12 };

/** Extract the 4-digit year from a freeform date string, or null. */
export function extractDateYear(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

/** Classify a freeform date string's precision: "day", "month", "year", or "unknown". */
export function getDatePrecision(value) {
  const text = String(value ?? "").trim();
  if (!text) return "unknown";

  if (/^\d{4}$/.test(text)) return "year";

  const monthRe = new RegExp(MONTH_NAMES, "i");
  const hasNamedMonth = monthRe.test(text);
  const hasDayNumber = /\b\d{1,2}\b/.test(text.replace(/\b(19|20)\d{2}\b/, ""));
  const isIsoDate = /\b\d{4}-\d{2}-\d{2}\b/.test(text);
  const isSlashDate = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(text);

  if (isIsoDate || isSlashDate) return "day";
  if (hasNamedMonth && hasDayNumber) return "day";
  if (hasNamedMonth) return "month";

  const isSlashMonthYear = /^\d{1,2}\/\d{4}$/.test(text);
  if (isSlashMonthYear) return "month";

  return "unknown";
}

/** Extract a month*100+day style value for within-year/within-month comparison. 0 if unavailable. */
function getWithinYearValue(value, precision) {
  const text = String(value ?? "").trim();
  if (precision === "year" || precision === "unknown") return 0;

  const isoMatch = text.match(/\b\d{4}-(\d{2})-(\d{2})\b/);
  if (isoMatch) return parseInt(isoMatch[1], 10) * 100 + parseInt(isoMatch[2], 10);

  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/\d{2,4}\b/);
  if (slashMatch) return parseInt(slashMatch[1], 10) * 100 + parseInt(slashMatch[2], 10);

  const slashMonthYear = text.match(/^(\d{1,2})\/\d{4}$/);
  if (slashMonthYear) return parseInt(slashMonthYear[1], 10) * 100;

  const monthRe = new RegExp(`\\b(${MONTH_NAMES})\\b`, "i");
  const monthMatch = text.match(monthRe);
  if (monthMatch) {
    const month = MONTH_INDEX[monthMatch[1].toLowerCase()] || 0;
    if (precision === "day") {
      const dayMatch = text.replace(/\b(19|20)\d{2}\b/, "").match(/\b(\d{1,2})\b/);
      const day = dayMatch ? parseInt(dayMatch[1], 10) : 0;
      return month * 100 + day;
    }
    return month * 100;
  }

  return 0;
}

const PRECISION_RANK = { year: 1, unknown: 1, month: 2, day: 3 };

/** Derive a numeric sort key from free-text or ISO dates. Cross-year comparable. */
export function parseSortKey(value) {
  if (!value) return 0;
  if (value.toDate) return value.toDate().getTime();
  if (typeof value === "number") return value;

  const year = extractDateYear(value);
  if (year === null) return 0;

  const precision = getDatePrecision(value);
  const withinYear = getWithinYearValue(value, precision);
  return year * 1e6 + withinYear;
}

/** Group items by extracted year. */
function groupByYear(items) {
  const groups = {};
  items.forEach((item) => {
    const year = extractDateYear(item.date) ?? "unknown";
    (groups[year] ??= []).push(item);
  });
  return groups;
}

/** A year-group is ambiguous (needs manual ordering) unless every item in it
    is day-precise with a distinct exact date string. */
export function isAmbiguousGroup(group) {
  if (!group || group.length < 2) return false;
  const allDayLevel = group.every((i) => getDatePrecision(i.date) === "day");
  if (!allDayLevel) return true;
  const distinctDates = new Set(group.map((i) => String(i.date ?? "").trim()));
  return distinctDates.size !== group.length;
}

export function sortHistoryItems(items, direction = "desc") {
  const dir = direction === "asc" ? 1 : -1;
  const groups = groupByYear(items);

  return [...items].sort((a, b) => {
    const yearA = extractDateYear(a.date) ?? 0;
    const yearB = extractDateYear(b.date) ?? 0;
    if (yearA !== yearB) return (yearA - yearB) * dir;

    const group = groups[yearA] ?? groups["unknown"];
    if (isAmbiguousGroup(group)) {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      return (orderA - orderB) * dir;
    }

    const keyA = a.sortKey ?? parseSortKey(a.date);
    const keyB = b.sortKey ?? parseSortKey(b.date);
    return (keyA - keyB) * dir;
  });
}

/** Backfill `order` for items in ambiguous year-groups that haven't been
    manually reordered yet (orderSource !== "manual"). Recomputes (not just
    fills gaps) so stale order values from earlier logic get corrected.
    Default order ranks by precision (less precise = earlier by default,
    i.e. day-level dates automatically outrank month/year-level ones),
    then by within-precision chronological value. Admin can drag to override,
    which marks the group as manually ordered and exempts it from future
    auto-recompute. */
export function computeBackfillOrder(items) {
  const groups = groupByYear(items);
  const updates = [];

  Object.values(groups).forEach((group) => {
    if (!isAmbiguousGroup(group)) return;
    const hasManualOrder = group.some((i) => i.orderSource === "manual");
    if (hasManualOrder) return;

    const ranked = [...group].sort((a, b) => {
      const precA = getDatePrecision(a.date);
      const precB = getDatePrecision(b.date);
      const rankA = PRECISION_RANK[precA] ?? 1;
      const rankB = PRECISION_RANK[precB] ?? 1;
      if (rankA !== rankB) return rankA - rankB;

      const valA = getWithinYearValue(a.date, precA);
      const valB = getWithinYearValue(b.date, precB);
      if (valA !== valB) return valA - valB;

      const createdA = a.createdAt?.seconds ?? 0;
      const createdB = b.createdAt?.seconds ?? 0;
      return createdA - createdB;
    });

    ranked.forEach((item, idx) => {
      if (item.order === idx && item.orderSource === "auto") return;
      item.order = idx;
      item.orderSource = "auto";
      updates.push({ id: item.id, order: idx, orderSource: "auto" });
    });
  });

  return updates;
}

export async function getHistory(direction = "desc") {
  const snap = await getDocs(collection(db, "history"));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return sortHistoryItems(items, direction);
}

export async function createHistory(data) {
  const date = data.date?.trim() ?? "";
  const year = extractDateYear(date);
  const snap = await getDocs(collection(db, "history"));
  const sameYear = snap.docs
    .map((d) => d.data())
    .filter((d) => extractDateYear(d.date) === year);
  const order = sameYear.length
    ? Math.max(...sameYear.map((d) => d.order ?? 0)) + 1
    : 0;
  const ref = await addDoc(collection(db, "history"), {
    ...data,
    date,
    order,
    orderSource: "auto",
    sortKey: parseSortKey(date),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateHistory(id, data) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  if (data.date !== undefined) {
    const date = data.date.trim();
    payload.date = date;
    payload.sortKey = parseSortKey(date);
  }
  await updateDoc(doc(db, "history", id), payload);
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

/** Display history date — always shown exactly as entered (free text) */
export function displayHistoryDate(value) {
  return value ?? "";
}