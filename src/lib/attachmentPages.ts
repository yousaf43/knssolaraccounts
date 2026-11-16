// Turns an attached serial sheet into printable images. PDFs are rendered page by page.
export async function attachmentPages(url?: string, path = ""): Promise<string[]> {
  if (!url) return [];
  if (!/\.pdf$/i.test(path) && !/\.pdf(\?|$)/i.test(url)) return [url];
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const data = await (await fetch(url)).arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    pages.push(canvas.toDataURL("image/jpeg", 0.9));
  }
  return pages;
}
