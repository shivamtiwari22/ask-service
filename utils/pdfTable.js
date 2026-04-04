/**
 * Draw a bordered table on a PDFKit document.
 * Grid lines are drawn first; text is drawn on top so borders stay visible and align.
 * @param {PDFKit.PDFDocument} doc - PDFKit document
 * @param {Object} options
 * @param {string[]} options.headers - Column headers
 * @param {string[][]} options.rows - Array of rows (each row is array of cell strings)
 * @param {number[]} options.columnWidths - Width of each column in points
 * @param {number} [options.startX=40] - Left margin
 * @param {number} [options.rowHeight=20] - Height of each data row
 * @param {number} [options.headerHeight=24] - Height of header row
 * @returns {number} - Final Y position after the table
 */
export function drawPdfTable(
  doc,
  {
    headers,
    rows,
    columnWidths,
    startX = 40,
    rowHeight = 20,
    headerHeight = 24,
  },
) {
  const padding = 6;
  const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
  const tableTopY = doc.y;
  const tableBottomY = tableTopY + headerHeight + rows.length * rowHeight;

  doc.lineWidth(0.75);
  doc.strokeColor("#000000");
  doc.fillColor("#000000");

  // Truncate text to fit cell width (uses current font)
  function truncate(str, maxWidth) {
    const s = String(str ?? "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    if (doc.widthOfString(s) <= maxWidth) return s;
    let t = s;
    while (t.length > 0 && doc.widthOfString(`${t}...`) > maxWidth) {
      t = t.slice(0, -1);
    }
    return t.length < s.length ? `${t}...` : s;
  }

  // Column boundary X positions: left edge of col 0 .. right edge of table
  const colXs = [startX];
  for (let i = 0; i < columnWidths.length; i++) {
    colXs.push(colXs[colXs.length - 1] + columnWidths[i]);
  }

  // 1) Header background, then stroke grid on top (lines remain visible on gray)
  doc.rect(startX, tableTopY, tableWidth, headerHeight).fill("#e8e8e8");
  doc.fillColor("#000000");

  // 2) Outer border + full-height verticals + horizontals (grid)
  for (let i = 0; i < colXs.length; i++) {
    const vx = colXs[i];
    doc.moveTo(vx, tableTopY).lineTo(vx, tableBottomY).stroke();
  }

  const horizontalYs = [tableTopY, tableTopY + headerHeight];
  for (let r = 0; r < rows.length; r++) {
    horizontalYs.push(tableTopY + headerHeight + (r + 1) * rowHeight);
  }
  horizontalYs.forEach((hy) => {
    doc.moveTo(startX, hy).lineTo(startX + tableWidth, hy).stroke();
  });

  // 3) Header text (truncated so narrow columns e.g. "Currency" stay on one line)
  doc.fontSize(10).font("Helvetica-Bold");
  let x = startX;
  headers.forEach((h, i) => {
    const maxW = columnWidths[i] - padding * 2;
    const label = truncate(String(h).trim(), maxW);
    const lineH = doc.heightOfString(label, { width: maxW });
    const textY = yCenterInCell(tableTopY, headerHeight, lineH);
    doc.text(label, x + padding, textY, {
      width: maxW,
      lineGap: 0,
    });
    x += columnWidths[i];
  });

  // 4) Body text
  doc.font("Helvetica").fontSize(9);
  let y = tableTopY + headerHeight;
  rows.forEach((row) => {
    const rowY = y;
    x = startX;
    row.forEach((cell, i) => {
      const maxTextWidth = columnWidths[i] - padding * 2;
      const cellText = truncate(cell, maxTextWidth);
      const lineH = doc.heightOfString(cellText, { width: maxTextWidth });
      const textY = yCenterInCell(rowY, rowHeight, lineH);
      doc.text(cellText, x + padding, textY, {
        width: maxTextWidth,
        lineGap: 0,
      });
      x += columnWidths[i];
    });
    y += rowHeight;
  });

  doc.y = tableBottomY + 12;
  return doc.y;
}

function yCenterInCell(cellTop, cellHeight, contentHeight) {
  const ch = Math.min(contentHeight, cellHeight - 4);
  return cellTop + (cellHeight - ch) / 2;
}
