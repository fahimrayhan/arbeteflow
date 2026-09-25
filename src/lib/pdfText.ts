
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 20;
const MAX_TEXT_LENGTH = 50_000;

export class PdfTextExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfTextExtractionError";
  }
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new PdfTextExtractionError("Please choose a PDF file.");
  }

  if (file.size === 0) {
    throw new PdfTextExtractionError("The selected PDF is empty.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new PdfTextExtractionError(
      "This PDF is larger than 10 MB. Please upload a smaller file.",
    );
  }

  let pdf: Awaited<ReturnType<typeof getDocument>["promise"]> | undefined;

  try {
    const pdfBytes = new Uint8Array(await file.arrayBuffer());
    pdf = await getDocument({ data: pdfBytes }).promise;
  } catch {
    throw new PdfTextExtractionError(
      "This file could not be read as a valid PDF.",
    );
  }

  try {
    if (pdf.numPages > MAX_PAGES) {
      throw new PdfTextExtractionError(
        "This PDF has more than 20 pages. Please upload a shorter resume.",
      );
    }

    const pages: string[] = [];

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber += 1
    ) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent({
        normalizeWhitespace: true,
      });

      const pageText = textContent.items
        .map((item) => {
          if (!("str" in item)) {
            return "";
          }

          const text = item.str.trim();

          if (!text) {
            return "";
          }

          return item.hasEOL ? `${text}\n` : `${text} `;
        })
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();

      if (pageText) {
        pages.push(pageText);
      }
    }

    const extractedText = pages.join("\n\n").trim();

    if (!extractedText) {
      throw new PdfTextExtractionError(
        "No selectable text was found in this PDF. It may be a scanned/image-only PDF and needs OCR.",
      );
    }

    if (extractedText.length > MAX_TEXT_LENGTH) {
      return `${extractedText.slice(0, MAX_TEXT_LENGTH)}\n\n[Imported text was truncated because the PDF is very large.]`;
    }

    return extractedText;
  } catch (error) {
    if (error instanceof PdfTextExtractionError) {
      throw error;
    }

    throw new PdfTextExtractionError(
      "The PDF text could not be extracted.",
    );
  } finally {
    await pdf.destroy();
  }
}