/** Browser: the file downloads. A UTF-8 byte-order mark makes Excel read accented text correctly. */
export async function shareTextFile(name: string, text: string, mimeType: string): Promise<void> {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Browser: opens the print dialog, where "Save as PDF" is one of the choices. */
export async function sharePdf(html: string): Promise<void> {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  frame.srcdoc = html;
  await new Promise<void>((resolve) => {
    frame.onload = () => resolve();
  });
  frame.contentWindow?.print();
  setTimeout(() => frame.remove(), 60_000);
}
