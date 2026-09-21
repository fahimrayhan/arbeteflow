/** Opens a styled popup window and triggers the browser print dialog (→ Save as PDF). */
function printWindow(htmlContent: string) {
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) {
    alert('Please allow popups to export PDF, then try again.');
    return;
  }
  win.document.write(htmlContent);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

/* ─── Resume ──────────────────────────────────────────────────────────────── */

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseResumeToHtml(text: string): string {
  const lines = text.split('\n');
  let html = '';
  let nameSet = false;
  let contactSet = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) {
      html += '<div class="gap"></div>';
      continue;
    }

    const safe = escapeHtml(trimmed);

    // First substantive non-contact line → name
    if (!nameSet && !trimmed.includes('@') && !trimmed.match(/\d{3}[-.\s]\d{3}/) && trimmed.length < 60) {
      nameSet = true;
      html += `<div class="name">${safe}</div>`;
      continue;
    }

    // Contact line: has @, phone, linkedin, github
    if (!contactSet && (trimmed.includes('@') || trimmed.match(/\(\d{3}\)|\d{3}[-.\s]\d{3}|linkedin|github/i))) {
      contactSet = true;
      html += `<div class="contact">${safe.replace(/\s*\|\s*/g, ' &nbsp;·&nbsp; ')}</div>`;
      continue;
    }

    // Section header: ALL CAPS, short, only letters/spaces/& and maybe /
    if (
      trimmed === trimmed.toUpperCase() &&
      trimmed.length >= 3 &&
      trimmed.length <= 40 &&
      /^[A-Z][A-Z\s\/&]+$/.test(trimmed)
    ) {
      html += `<div class="section-head">${safe}</div>`;
      continue;
    }

    // Bullet point
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      html += `<div class="bullet">&#8226;&nbsp;${escapeHtml(trimmed.slice(2))}</div>`;
      continue;
    }

    // Job / role header line (contains — | – or year range)
    if (trimmed.match(/—|–| - | \| /) && trimmed.match(/20\d{2}|19\d{2}|Present/i)) {
      html += `<div class="job-head">${safe}</div>`;
      continue;
    }

    // Institution or role line (no date, but has a dash delimiter)
    if (trimmed.match(/ — | – | \| /) && !trimmed.startsWith('-')) {
      html += `<div class="sub-head">${safe}</div>`;
      continue;
    }

    // Fallback: body line
    html += `<div class="body-line">${safe}</div>`;
  }

  return html;
}

export function exportResumePDF(text: string, filename = 'resume') {
  const content = parseResumeToHtml(text);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${filename}</title>
<style>
  @page { size: letter; margin: 0.75in 0.85in; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Calibri', 'Arial', sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .name {
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: #111;
    margin-bottom: 3pt;
  }
  .contact {
    font-size: 9pt;
    color: #444;
    margin-bottom: 14pt;
    border-bottom: 1.5pt solid #65A30D;
    padding-bottom: 6pt;
  }
  .section-head {
    font-size: 9.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #65A30D;
    text-transform: uppercase;
    border-bottom: 1pt solid #65A30D;
    padding-bottom: 2pt;
    margin-top: 13pt;
    margin-bottom: 5pt;
  }
  .job-head {
    font-weight: 700;
    font-size: 10.5pt;
    margin-top: 7pt;
    margin-bottom: 2pt;
  }
  .sub-head {
    font-weight: 600;
    font-size: 10pt;
    color: #333;
    margin-top: 4pt;
    margin-bottom: 1pt;
  }
  .bullet {
    padding-left: 13pt;
    text-indent: -6pt;
    font-size: 10pt;
    margin-bottom: 2pt;
    color: #222;
  }
  .body-line {
    font-size: 10pt;
    margin-bottom: 2pt;
    color: #333;
  }
  .gap { height: 5pt; }

  @media print {
    body { margin: 0; }
    .section-head { color: #65A30D !important; border-color: #65A30D !important; }
    .contact { border-color: #65A30D !important; }
  }
</style>
</head>
<body>${content}</body>
</html>`;

  printWindow(html);
}

/* ─── Cover Letter ─────────────────────────────────────────────────────────── */

function parseCoverLetterToHtml(text: string): string {
  // Split on blank lines to get paragraphs, handle individual line breaks within
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    const lines = trimmed.split('\n').map((l) => escapeHtml(l.trim())).join('<br>');
    return `<p>${lines}</p>`;
  }).filter(Boolean).join('\n');
}

export function exportCoverLetterPDF(text: string, role: string, company: string) {
  const content = parseCoverLetterToHtml(text);
  const safeRole    = escapeHtml(role    || 'Position');
  const safeCompany = escapeHtml(company || 'Company');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Cover Letter – ${safeRole} at ${safeCompany}</title>
<style>
  @page { size: letter; margin: 1in; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Calibri', 'Georgia', serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    border-bottom: 2pt solid #65A30D;
    padding-bottom: 10pt;
    margin-bottom: 24pt;
  }
  .role-co {
    font-size: 10.5pt;
    font-weight: 700;
    color: #65A30D;
  }
  .role-sub {
    font-size: 9pt;
    color: #666;
    margin-top: 2pt;
  }
  .doc-label {
    font-size: 9pt;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  p {
    margin-bottom: 11pt;
    font-size: 11pt;
    color: #1a1a1a;
  }
  p:first-of-type { margin-top: 0; }

  @media print {
    header { border-color: #65A30D !important; }
    .role-co { color: #65A30D !important; }
  }
</style>
</head>
<body>
  <header>
    <div>
      <div class="role-co">${safeRole}</div>
      <div class="role-sub">${safeCompany}</div>
    </div>
    <div class="doc-label">Cover Letter</div>
  </header>
  ${content}
</body>
</html>`;

  printWindow(html);
}
