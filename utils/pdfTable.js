/**
 * Draw a bordered table on a PDFKit document.
 * @param {PDFKit.PDFDocument} doc - PDFKit document
 * @param {Object} options
 * @param {string[]} options.headers - Column headers
 * @param {string[][]} options.rows - Array of rows (each row is array of cell strings)
 * @param {number[]} options.columnWidths - Width of each column in points
 * @param {number} [options.startX=40] - Left margin
 * @param {number} [options.rowHeight=20] - Height of each data row
 * @param {number} [options.headerHeight=22] - Height of header row
 * @returns {number} - Final Y position after the table
 */
export function drawPdfTable(doc, { headers, rows, columnWidths, startX = 40, rowHeight = 20, headerHeight = 22 }) {
  const padding = 6;
  const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
  let y = doc.y;

  // Ensure all text and lines are clearly visible (black)
  doc.fillColor("#000000");
  doc.strokeColor("#000000");

  // Truncate text to fit cell width
  function truncate(str, maxWidth) {
    const s = String(str ?? "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    if (doc.widthOfString(s) <= maxWidth) return s;
    let t = s;
    while (t.length > 0 && doc.widthOfString(t + "...") > maxWidth) {
      t = t.slice(0, -1);
    }
    return t.length < s.length ? t + "..." : s;
  }

  // Header row – background and borders
  doc.rect(startX, y, tableWidth, headerHeight).fill("#e8e8e8");
  doc.fillColor("#000000"); // reset to black so header text is visible
  doc.rect(startX, y, tableWidth, headerHeight).stroke();
  let x = startX;
  doc.fontSize(10).font("Helvetica-Bold");
  headers.forEach((h, i) => {
    const label = String(h).trim();
    if (label) {
      doc.text(label, x + padding, y + (headerHeight - doc.heightOfString(label)) / 2, {
        width: columnWidths[i] - padding * 2,
      });
    }
    x += columnWidths[i];
    if (i < headers.length - 1) {
      doc.moveTo(x, y).lineTo(x, y + headerHeight).stroke();
    }
  });
  doc.font("Helvetica").fontSize(9);
  doc.fillColor("#000000");
  y += headerHeight;

  // Horizontal line under header
  doc.moveTo(startX, y).lineTo(startX + tableWidth, y).stroke();

  // Data rows
  rows.forEach((row, rowIndex) => {
    const rowY = y;
    x = startX;
    doc.fillColor("#000000");
    row.forEach((cell, i) => {
      const maxTextWidth = columnWidths[i] - padding * 2;
      const cellText = truncate(cell, maxTextWidth);
      doc.text(cellText, x + padding, rowY + (rowHeight - doc.heightOfString(cellText)) / 2, {
        width: columnWidths[i] - padding * 2,
      });
      x += columnWidths[i];
      if (i < row.length - 1) {
        doc.moveTo(x, rowY).lineTo(x, rowY + rowHeight).stroke();
      }
    });
    doc.moveTo(startX, rowY + rowHeight).lineTo(startX + tableWidth, rowY + rowHeight).stroke();
    y = rowY + rowHeight;
  });

  // Outer border (right edge for data section)
  doc.moveTo(startX + tableWidth, y - rows.length * rowHeight).lineTo(startX + tableWidth, y).stroke();

  doc.y = y + 12;
  return doc.y;
}
