import { PDFDocument, PDFForm, PDFPage, PDFImage } from "pdf-lib";

type DrawPdfImageOptions = {
  pdfDoc: PDFDocument;
  form: PDFForm;
  page: PDFPage;
  fieldName: string;
  imageBytes: Uint8Array;
  width?: number;
  height?: number;
  yOffset?: number;
};

// Simple sniffer for PNG/JPG
function detectImageType(bytes: Uint8Array): "png" | "jpg" {
  // PNG magic: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "png";
  }
  // JPEG starts with FF D8
  if (bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "jpg";
  }
  // default to png attempt, pdf-lib will throw if wrong
  return "png";
}

/**
 * Draws an image (PNG or JPG) on top of a named text field, placed on the correct page.
 */
export async function drawPdfImage({ pdfDoc, form, page, fieldName, imageBytes, width = 120, height = 40, yOffset = 0 }: DrawPdfImageOptions): Promise<void> {
  const field = form.getTextField(fieldName);
  const widget = field.acroField.getWidgets()[0];
  const rect = widget.getRectangle();

  const x = rect.x;
  const y = rect.y + yOffset;

  let image: PDFImage;
  const kind = detectImageType(imageBytes);

  try {
    image = kind === "png" ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
  } catch {
    // fallback: try the other one
    image = kind === "png" ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes);
  }

  page.drawImage(image, { x, y, width, height });

  // Optionally clear text field contents so only image is visible
  field.setText("");
}
