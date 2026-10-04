import type { jsPDF } from 'jspdf';

/*
  PDF export: builds a real A4 PDF file and downloads it — no popup window and no
  print dialog. jsPDF is loaded on demand so it stays out of the main bundle.

  Text uses the built-in Helvetica font (WinAnsi encoding): Latin scripts including
  Swedish å ä ö, accents, en/em dashes and bullets render correctly. Characters
  outside that set (e.g. Greek, Cyrillic, CJK, emoji) cannot be drawn and are replaced
  with "?"; the number replaced is returned so the UI can tell the user.
*/

export type PdfExportResult = { replacedCharacters: number };

const PRIMARY = '#65A30D';
const MM_PER_PT = 25.4 / 72;

/* ─── Text sanitising ─────────────────────────────────────────────────────── */

const LOOKALIKES: Record<string, string> = {
  '‘': "'", '’': "'", '‚': ',', '‛': "'",
  '“': '"', '”': '"', '„': '"',
  '…': '...', '→': '->', '←': '<-', '‑': '-', '−': '-',
  '⁃': '-', '▪': '•', '●': '•', '‣': '•',
  ' ': ' ', ' ': ' ', ' ': ' ', '​': '', '﻿': '', '\t': '  ',
};

// Printable ASCII, Latin-1, and the WinAnsi extras that sit outside Latin-1.
const SUPPORTED = /[\n\x20-\x7E¡-ÿ–—•€™ŒœŠšŸŽž]/;

function toPdfText(input: string): { text: string; replaced: number } {
  let replaced = 0;
  let text = '';

  for (const char of input.normalize('NFC').replace(/\r\n?/g, '\n')) {
    const mapped = LOOKALIKES[char] ?? char;

    for (const part of mapped) {
      if (SUPPORTED.test(part)) {
        text += part;
      } else {
        text += '?';
        replaced += 1;
      }
    }
  }

  return { text, replaced };
}

/* ─── Page layout helper ──────────────────────────────────────────────────── */

type Margins = { top: number; bottom: number; left: number; right: number };

type TextStyle = {
  size: number;
  bold?: boolean;
  color?: string;
  /** Line height as a multiple of the font size. */
  leading?: number;
  /** Left indent in mm. */
  indent?: number;
  before?: number;
  after?: number;
  /** Extra letter spacing in points. */
  charSpace?: number;
  upper?: boolean;
};

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

class PageWriter {
  y: number;
  readonly width: number;
  readonly height: number;

  constructor(
    readonly doc: jsPDF,
    readonly margins: Margins,
  ) {
    this.width = doc.internal.pageSize.getWidth();
    this.height = doc.internal.pageSize.getHeight();
    this.y = margins.top;
  }

  get contentWidth(): number {
    return this.width - this.margins.left - this.margins.right;
  }

  private applyFont(style: TextStyle) {
    this.doc.setFont('helvetica', style.bold ? 'bold' : 'normal');
    this.doc.setFontSize(style.size);
    this.doc.setTextColor(...hexToRgb(style.color ?? '#1a1a1a'));
    // jsPDF measures character spacing in document units (mm); styles are written in points.
    this.doc.setCharSpace((style.charSpace ?? 0) * MM_PER_PT);
  }

  private lineHeight(style: TextStyle): number {
    return style.size * (style.leading ?? 1.4) * MM_PER_PT;
  }

  /** Starts a new page when `height` mm no longer fits. */
  ensureSpace(height: number) {
    if (this.y + height > this.height - this.margins.bottom) {
      this.doc.addPage();
      this.y = this.margins.top;
    }
  }

  gap(height: number) {
    this.y += height;
  }

  /** Wrapped text block. `keepWithNext` reserves room for following lines to avoid orphaned headings. */
  text(content: string, style: TextStyle, keepWithNext = 0) {
    this.applyFont(style);

    const indent = style.indent ?? 0;
    const value = style.upper ? content.toUpperCase() : content;
    const lines: string[] = this.doc.splitTextToSize(value, this.contentWidth - indent);
    const lineHeight = this.lineHeight(style);

    this.y += style.before ?? 0;
    this.ensureSpace(lineHeight + keepWithNext);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.applyFont(style);
      // Baseline sits ~0.8 of the line box below its top.
      this.doc.text(line, this.margins.left + indent, this.y + style.size * MM_PER_PT * 0.85 + (lineHeight - style.size * MM_PER_PT) / 2);
      this.y += lineHeight;
    }

    this.y += style.after ?? 0;
    this.doc.setCharSpace(0);
  }

  /** A bullet: marker in the margin, text hanging-indented. */
  bullet(content: string, style: TextStyle) {
    const indent = style.indent ?? 5;
    this.applyFont(style);
    const lines: string[] = this.doc.splitTextToSize(content, this.contentWidth - indent);
    const lineHeight = this.lineHeight(style);

    this.y += style.before ?? 0;

    lines.forEach((line, index) => {
      this.ensureSpace(lineHeight);
      this.applyFont(style);
      const baseline = this.y + style.size * MM_PER_PT * 0.85 + (lineHeight - style.size * MM_PER_PT) / 2;
      if (index === 0) this.doc.text('•', this.margins.left + indent - 3.2, baseline);
      this.doc.text(line, this.margins.left + indent, baseline);
      this.y += lineHeight;
    });

    this.y += style.after ?? 0;
  }

  rule(color: string, thickness: number, after = 0) {
    this.doc.setDrawColor(...hexToRgb(color));
    this.doc.setLineWidth(thickness);
    this.doc.line(this.margins.left, this.y, this.width - this.margins.right, this.y);
    this.y += after;
  }

  /** "Page x of y" on every page when there is more than one. */
  addPageNumbers() {
    const pages = this.doc.getNumberOfPages();
    if (pages < 2) return;

    for (let page = 1; page <= pages; page += 1) {
      this.doc.setPage(page);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      this.doc.setTextColor(...hexToRgb('#999999'));
      this.doc.text(`Page ${page} of ${pages}`, this.width / 2, this.height - 8, { align: 'center' });
    }
  }
}

async function createDocument(title: string): Promise<jsPDF> {
  const { jsPDF: PDF } = await import('jspdf');
  const doc = new PDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  doc.setProperties({ title });
  return doc;
}

/* ─── Resume ──────────────────────────────────────────────────────────────── */

type ResumeLine =
  | { kind: 'name' | 'title' | 'contact' | 'section' | 'job' | 'sub' | 'body' | 'bullet'; text: string }
  | { kind: 'gap' };

const BULLET_PREFIX = /^[-•*–·▪●]\s+/;
const CONTACT_HINT = /@|linkedin|github|https?:\/\/|\(\d{3}\)|\+?\d[\d\s().-]{7,}\d/i;
const SECTION_HEAD = /^[\p{Lu}\d\s&/,.()\-–]+$/u;
const DATE_HINT = /(19|20)\d{2}|present|current|\bnu\b|pågående/i;

function isSectionHead(line: string): boolean {
  return (
    line.length >= 3 &&
    line.length <= 45 &&
    SECTION_HEAD.test(line) &&
    (line.match(/\p{L}/gu)?.length ?? 0) >= 3 &&
    !BULLET_PREFIX.test(line)
  );
}

/** Headings are short lines; a long or sentence-like line is body text even if it contains a dash. */
function isHeadingLike(line: string): boolean {
  return line.length <= 90 && !/[.!?]$/.test(line);
}

function classifyResume(text: string): ResumeLine[] {
  const result: ResumeLine[] = [];
  let seenContent = false;
  let lastKind: ResumeLine['kind'] | undefined;
  let contactSeen = false;

  for (const raw of text.split('\n')) {
    const line = raw.trim();

    if (!line) {
      if (lastKind !== 'gap' && seenContent) result.push({ kind: 'gap' });
      lastKind = 'gap';
      continue;
    }

    let kind: Exclude<ResumeLine['kind'], 'gap'>;
    let content = line;

    if (BULLET_PREFIX.test(line)) {
      kind = 'bullet';
      content = line.replace(BULLET_PREFIX, '');
    } else if (!seenContent && !CONTACT_HINT.test(line) && line.length <= 60) {
      kind = 'name';
    } else if (!contactSeen && CONTACT_HINT.test(line)) {
      kind = 'contact';
      contactSeen = true;
    } else if (lastKind === 'name' && !isSectionHead(line) && line.length <= 80 && !CONTACT_HINT.test(line)) {
      kind = 'title';
    } else if (isSectionHead(line)) {
      kind = 'section';
    } else if (isHeadingLike(line) && / \| | — | – |—|–/.test(line) && DATE_HINT.test(line)) {
      kind = 'job';
    } else if (isHeadingLike(line) && / \| | — | – /.test(line)) {
      kind = 'sub';
    } else {
      kind = 'body';
    }

    result.push({ kind, text: content });
    seenContent = true;
    lastKind = kind;
  }

  return result;
}

export async function buildResumePdf(
  text: string,
  title: string,
): Promise<{ doc: jsPDF; replacedCharacters: number }> {
  const { text: safeText, replaced } = toPdfText(text);
  const doc = await createDocument(title);
  const page = new PageWriter(doc, { top: 18, bottom: 18, left: 20, right: 20 });

  for (const item of classifyResume(safeText)) {
    switch (item.kind) {
      case 'gap':
        page.gap(1.8);
        break;
      case 'name':
        page.text(item.text, { size: 22, bold: true, color: '#111111', leading: 1.15, after: 1 });
        break;
      case 'title':
        page.text(item.text, { size: 11.5, color: '#444444', after: 1.5 });
        break;
      case 'contact':
        page.text(item.text.replace(/\s*\|\s*/g, '  ·  '), { size: 9, color: '#444444', after: 1.5 });
        page.rule(PRIMARY, 0.5, 3);
        break;
      case 'section':
        page.text(item.text, { size: 9.5, bold: true, color: PRIMARY, before: 4.5, after: 0.8, charSpace: 0.8, upper: true }, 14);
        page.rule(PRIMARY, 0.3, 2);
        break;
      case 'job':
        page.text(item.text, { size: 10.5, bold: true, color: '#111111', before: 1.8, after: 0.4 }, 8);
        break;
      case 'sub':
        page.text(item.text, { size: 10, bold: true, color: '#333333', before: 1, after: 0.3 }, 8);
        break;
      case 'bullet':
        page.bullet(item.text, { size: 10, color: '#222222', indent: 5, after: 0.5 });
        break;
      default:
        page.text(item.text, { size: 10, color: '#333333', after: 0.5 });
    }
  }

  page.addPageNumbers();
  return { doc, replacedCharacters: replaced };
}

export async function exportResumePDF(text: string, filename = 'resume'): Promise<PdfExportResult> {
  const { doc, replacedCharacters } = await buildResumePdf(text, filename);
  doc.save(`${filename}.pdf`);
  return { replacedCharacters };
}

/* ─── Cover letter ────────────────────────────────────────────────────────── */

export async function buildCoverLetterPdf(
  text: string,
  role: string,
  company: string,
  title: string,
): Promise<{ doc: jsPDF; replacedCharacters: number }> {
  const body = toPdfText(text);
  const safeRole = toPdfText(role || 'Position');
  const safeCompany = toPdfText(company || 'Company');

  const doc = await createDocument(title);
  const page = new PageWriter(doc, { top: 22, bottom: 22, left: 25, right: 25 });

  // Header: role + company on the left, document label on the right.
  const headerTop = page.y;
  page.text(safeRole.text, { size: 11, bold: true, color: PRIMARY, after: 0.5 });
  page.text(safeCompany.text, { size: 9.5, color: '#666666' });
  const headerBottom = page.y;

  const label = 'COVER LETTER';
  const labelSpacing = 0.8; // pt between letters

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...hexToRgb('#999999'));
  // jsPDF's right-align ignores letter spacing, so measure and place the label by hand.
  const labelWidth = doc.getTextWidth(label) + labelSpacing * MM_PER_PT * label.length;
  doc.setCharSpace(labelSpacing * MM_PER_PT);
  doc.text(label, page.width - page.margins.right - labelWidth, headerTop + 3.2);
  doc.setCharSpace(0);

  page.y = headerBottom + 3;
  page.rule(PRIMARY, 0.7, 9);

  for (const paragraph of body.text.split(/\n{2,}/)) {
    const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    lines.forEach((line, index) => {
      page.text(line, { size: 11, color: '#1a1a1a', leading: 1.5, after: index === lines.length - 1 ? 4 : 0 });
    });
  }

  page.addPageNumbers();

  return {
    doc,
    replacedCharacters: body.replaced + safeRole.replaced + safeCompany.replaced,
  };
}

/** `filename` becomes the downloaded file name (without extension). */
export async function exportCoverLetterPDF(
  text: string,
  role: string,
  company: string,
  filename?: string,
): Promise<PdfExportResult> {
  const name = filename || 'cover-letter';
  const { doc, replacedCharacters } = await buildCoverLetterPdf(
    text,
    role,
    company,
    `Cover Letter – ${role || 'Position'} at ${company || 'Company'}`,
  );
  doc.save(`${name}.pdf`);
  return { replacedCharacters };
}
