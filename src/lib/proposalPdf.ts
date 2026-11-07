import { proposalHtml } from './proposalPrint';

export async function proposalPdf(...args: Parameters<typeof proposalHtml>): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
  const frame = document.createElement('iframe');
  frame.title = 'Proposal PDF';
  frame.className = 'proposal-pdf-frame';
  document.body.appendChild(frame);
  try {
    const doc = frame.contentDocument;
    if (!doc) throw new Error('Cannot prepare PDF');
    doc.open(); doc.write(proposalHtml(...args)); doc.close();
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => { image.onload = image.onerror = () => resolve(); })));
    if (Array.from(doc.images).some(image => !image.naturalWidth)) throw new Error('Proposal photos could not load; sending stopped');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    let pageNumber = 0;
    for (const section of Array.from(doc.querySelectorAll<HTMLElement>('body > .page'))) {
      const canvas = await html2canvas(section, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff', windowWidth: 820 });
      const sliceHeight = Math.floor(canvas.width * 281 / 190);
      for (let top = 0; top < canvas.height; top += sliceHeight) {
        if (pageNumber++) pdf.addPage('a4', 'portrait');
        const slice = document.createElement('canvas');
        slice.width = canvas.width; slice.height = Math.min(sliceHeight, canvas.height - top);
        slice.getContext('2d')?.drawImage(canvas, 0, top, slice.width, slice.height, 0, 0, slice.width, slice.height);
        pdf.addImage(slice.toDataURL('image/jpeg', 0.84), 'JPEG', 10, 8, 190, slice.height * 190 / slice.width);
        for (const link of Array.from(section.querySelectorAll<HTMLAnchorElement>('a[href]'))) {
          const r = link.getBoundingClientRect(); const parent = section.getBoundingClientRect();
          const y = (r.top - parent.top) * 1.5 - top;
          if (y >= 0 && y < slice.height) pdf.link(10 + (r.left - parent.left) * 190 / parent.width, 8 + y * 190 / canvas.width, r.width * 190 / parent.width, Math.min(r.height * 190 / parent.width, 281), { url: link.href });
        }
      }
    }
    if (!pageNumber) throw new Error('Proposal PDF is empty');
    return pdf.output('blob');
  } finally { frame.remove(); }
}