// Trigger a client-side download of a Blob with a spec-style filename, e.g.
// `ssc-cgl_photo_30-10-26.jpg` (spec §FR-19). No server round-trip — the blob stays on device.

// `DD-MM-YY` of the download date. Slashes are illegal in filenames on Windows/Android, so the
// familiar dd/mm/yy shape is rendered with dashes.
function dateStamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(date.getDate())}-${p(date.getMonth() + 1)}-${p(date.getFullYear() % 100)}`;
}

export function filenameFor(examSlugOrId, docType, ext = "jpg", date = new Date()) {
  const base = String(examSlugOrId || "exam")
    .replace(/-photo-signature-size$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const doc = String(docType || "file").toLowerCase();
  return `${base}_${doc}_${dateStamp(date)}.${ext}`;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
