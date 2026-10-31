// Minimal single-image PDF writer. The processed JPEG is embedded without re-encoding
// (DCTDecode), and the page size in points equals the image's pixel dimensions — portals that
// inspect the PDF see exactly the spec pixels and the file keeps its validated KB size.
// buildPdfFromJpeg is pure (node-testable); imageBlobToPdf is the browser entry point.

export function buildPdfFromJpeg(jpeg, width, height) {
  const enc = new TextEncoder();
  const chunks = [];
  let length = 0;
  const push = (part) => {
    const b = typeof part === "string" ? enc.encode(part) : part;
    chunks.push(b);
    length += b.length;
  };
  const offsets = [];
  const beginObj = (id) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
  };
  const endObj = () => push("endobj\n");

  push("%PDF-1.4\n");

  beginObj(1);
  push("<< /Type /Catalog /Pages 2 0 R >>\n");
  endObj();

  beginObj(2);
  push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n");
  endObj();

  beginObj(3);
  push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> /ProcSet [/PDF /ImageC] >> /Contents 5 0 R >>\n`,
  );
  endObj();

  beginObj(4);
  push(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  push(jpeg);
  push("\nendstream\n");
  endObj();

  const content = `q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`;
  beginObj(5);
  push(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream\n`);
  endObj();

  const xrefOffset = length;
  push("xref\n0 6\n0000000000 65535 f \n");
  for (let i = 1; i <= 5; i++) push(`${String(offsets[i]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// Browser-side: wrap any image blob in a one-page PDF. JPEGs pass through untouched; other
// formats are flattened onto white and re-encoded (some signatures are transparent PNGs).
export async function imageBlobToPdf(blob) {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  let jpeg;
  if (blob.type === "image/jpeg") {
    jpeg = new Uint8Array(await blob.arrayBuffer());
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
    const bin = atob(b64);
    jpeg = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) jpeg[i] = bin.charCodeAt(i);
  }
  bitmap.close();
  return new Blob([buildPdfFromJpeg(jpeg, width, height)], { type: "application/pdf" });
}
