import { useEffect, useRef, type ReactNode } from 'react';
import { Check, Copy, Download, FileDown, Sparkles } from 'lucide-react';
import { Alert } from './Alert';
import { EmptyState } from './EmptyState';
import { cardStyle, fieldStyle, foregroundText, ghostButtonStyle, mutedText } from './styles';

interface GeneratedDocumentPanelProps {
  title: string;
  /** Pill shown next to the title once text exists, e.g. "AI enhanced". */
  badge: string;
  text: string;
  streaming: boolean;
  error: string;
  emptyTitle: string;
  emptyDescription: string;
  copied: boolean;
  onCopy: () => void;
  onDownloadTxt: () => void;
  onExportPdf: () => void;
  /** Allows the caller to edit generated text before saving or exporting. */
  onTextChange?: (text: string) => void;
  /** Explains where inline edits are used by the caller. */
  editHint?: string;
  /** Optional content under the output box (e.g. research sources). */
  footer?: ReactNode;
}

/** Right-hand output panel shared by the resume enhancer and cover letter generator. */
export function GeneratedDocumentPanel({
  title,
  badge,
  text,
  streaming,
  error,
  emptyTitle,
  emptyDescription,
  copied,
  onCopy,
  onDownloadTxt,
  onExportPdf,
  onTextChange,
  editHint = 'Edits are included when you copy, download, or export this document.',
  footer,
}: GeneratedDocumentPanelProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const editableRef = useRef<HTMLTextAreaElement>(null);

  // Follow the text while it streams in.
  useEffect(() => {
    if (streaming && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
    if (streaming && editableRef.current) {
      editableRef.current.scrollTop = editableRef.current.scrollHeight;
    }
  }, [text, streaming]);

  const actionClass = 'flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg';

  return (
    <section className="rounded-2xl p-5 min-h-[560px] flex flex-col" style={cardStyle}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />

          <h2 className="font-semibold" style={foregroundText}>
            {title}
          </h2>

          {text && (
            <span
              className="text-[11px] rounded-full px-2 py-0.5 font-semibold"
              style={{
                color: 'var(--color-primary)',
                background: 'rgba(163,230,53,0.1)',
              }}
            >
              {badge}
            </span>
          )}

          {streaming && (
            <span className="text-xs" style={mutedText}>
              Streaming…
            </span>
          )}
        </div>

        {text && !streaming && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCopy} className={actionClass} style={ghostButtonStyle}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button type="button" onClick={onDownloadTxt} className={actionClass} style={ghostButtonStyle}>
              <Download size={14} />
              .txt
            </button>

            <button type="button" onClick={onExportPdf} className={actionClass} style={ghostButtonStyle}>
              <FileDown size={14} />
              Export PDF
            </button>
          </div>
        )}
      </div>

      <div
        ref={outputRef}
        aria-live="polite"
        aria-busy={streaming}
        className="flex-1 min-h-[420px] overflow-y-auto rounded-xl p-4 text-sm leading-6"
        style={fieldStyle}
      >
        {error && (
          <Alert compact title="Error">
            {error}
          </Alert>
        )}

        {text ? (
          onTextChange ? (
            <>
              <textarea
                value={text}
                ref={editableRef}
                onChange={(event) => onTextChange(event.target.value)}
                readOnly={streaming}
                aria-label={`${title} editable text`}
                className="w-full min-h-[420px] resize-none bg-transparent outline-none font-sans"
                style={foregroundText}
              />
              {!streaming && (
                <p className="text-xs mt-2" style={mutedText}>
                  Click in the text to make corrections. {editHint}
                </p>
              )}
            </>
          ) : (
            <pre className="m-0 whitespace-pre-wrap font-sans" style={foregroundText}>
              {text}
              {streaming && (
                <span
                  className="inline-block w-2 h-4 ml-1 align-middle animate-pulse"
                  style={{ background: 'var(--color-primary)' }}
                />
              )}
            </pre>
          )
        ) : !streaming && !error ? (
          <EmptyState icon={Sparkles} title={emptyTitle} description={emptyDescription} />
        ) : null}
      </div>

      {footer}
      {text && (
        <p className="text-xs leading-5 mt-3" style={mutedText}>
          AI-generated draft using your configured model. Review every factual claim, metric,
          qualification, and company detail before using it.
        </p>
      )}
    </section>
  );
}
