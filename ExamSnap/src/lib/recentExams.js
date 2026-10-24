const KEY = "examsnap:recent-exams";
const LIMIT = 5;

export function getRecentExams() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(items) ? items.slice(0, LIMIT) : [];
  } catch { return []; }
}

export function saveRecentExam(item) {
  try {
    const existing = getRecentExams().filter((entry) => entry.key !== item.key);
    localStorage.setItem(KEY, JSON.stringify([{ ...item, savedAt: Date.now() }, ...existing].slice(0, LIMIT)));
  } catch { /* local storage may be unavailable; the tool still works */ }
}
