// Trigger a client-side download of a Blob with a spec-style filename, e.g.
// `ssc-cgl_photo.jpg` (spec §FR-19). No server round-trip — the blob stays on device.

export function filenameFor(examSlugOrId, docType, ext = "jpg") {
  const base = String(examSlugOrId || "exam")
    .replace(/-photo-signature-size$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const doc = String(docType || "file").toLowerCase();
  return `${base}_${doc}.${ext}`;
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
