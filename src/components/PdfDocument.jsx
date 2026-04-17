'use client';

export default function PdfDocument({ pdfUrl }) {
  return (
    <embed
      src={`${pdfUrl}#toolbar=1&navpanes=0`}
      type="application/pdf"
      style={{ width: '100%', flex: 1, border: 'none', borderRadius: 4, minHeight: 0 }}
    />
  );
}
