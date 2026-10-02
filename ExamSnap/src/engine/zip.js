// "Download all" as a ZIP (spec §4.5). JPEGs are already compressed, so we store (no deflate)
// — P2-FR-50. Includes a checklist.txt listing each file's dimensions and size (P2-FR-51).
// fflate is lazy-imported so it never touches the initial bundle.

const kb = (n) => Math.round(n * 10) / 10;

/** Plain-text manifest included in the ZIP. Pure (no fflate), so it's node-testable. */
export function buildChecklistText(items, examName) {
  const lines = [`ExamSnap kit: ${examName}`, `Generated: ${new Date().toISOString().slice(0, 10)}`, ""];
  for (const it of items) {
    lines.push(`${it.filename} — ${it.meta.width}x${it.meta.height}px, ${kb(it.meta.sizeKb)} KB`);
  }
  return lines.join("\n") + "\n";
}

/**
 * @param {Array<{ filename, blob, meta }>} items
 * @param {string} examName
 * @returns {Promise<Blob>} a STORE-mode zip
 */
export async function buildKitZip(items, examName) {
  const { zipSync, strToU8 } = await import("fflate");
  const files = {};
  for (const it of items) {
    const buf = new Uint8Array(await it.blob.arrayBuffer());
    files[it.filename] = [buf, { level: 0 }]; // STORE (no recompression)
  }
  files["checklist.txt"] = [strToU8(buildChecklistText(items, examName)), { level: 0 }];
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped], { type: "application/zip" });
}
