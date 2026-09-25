import PDFDocument from "pdfkit";

export function formatFrenchInvoiceDate(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d
    .toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    })
    .replace(/\./g, "");
}

export function buildInvoiceNumber(tx) {
  if (tx?.transaction_number) {
    return tx.transaction_number.replace(/^TXN-/, "INV-");
  }
  const d = tx?.createdAt ? new Date(tx.createdAt) : new Date();
  const year = d.getFullYear();
  const serial =
    tx?._id && tx._id.toString
      ? parseInt(tx._id.toString().slice(-4), 16) % 10000
      : 0;
  return `INV-${year}-${String(serial).padStart(4, "0")}`;
}

export function formatTransactionDateTime(date) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const datePart = d
    .toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "");

  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${datePart}, ${hours}:${minutes}`;
}

export function toTransactionId(transaction_number, _id, createdAt) {
  if (transaction_number) return transaction_number;
  if (!_id || !createdAt) return null;
  const year = new Date(createdAt).getFullYear();
  const num = parseInt(_id.toString().slice(-5), 16) % 100000;
  return `TXN-${year}-${String(num).padStart(5, "0")}`;
}

export function streamCreditPurchaseInvoice({
  res,
  tx,
  vendor,
  global,
  creditPackage,
}) {
  const totalHt = Number(
    creditPackage?.price ?? tx.amount_paid ?? tx.amount ?? 0,
  );
  const tvaRate = Number(global?.tva_rate || 0.2);
  const tvaAmount = Number((totalHt * tvaRate).toFixed(2));
  const totalTtc = Number((totalHt + tvaAmount).toFixed(2));
  const creditsAdded = Number(tx.amount || 0);
  const pricePerCredit = creditPackage?.per_credit_price || 0.2;
  const invoiceNumber = buildInvoiceNumber(tx);
  const issueDate = formatFrenchInvoiceDate(tx.createdAt) || "-";
  const currency = tx.currency || "EUR";
  const packageName = creditPackage?.name || tx.description || "Credits";
  const paymentMethod = tx.plat_form || "card";
  const paymentStatus = tx.status || "completed";
  const clientName = vendor?.business_name || "Vendor";
  const clientAddress = [vendor?.address, vendor?.postal_code, vendor?.city]
    .filter(Boolean)
    .join(", ");
  const clientSiret = vendor?.company_registration_number || "-";
  const platformName = global?.platformName || "Ask Service";
  const platformEmail = global?.email || "contact@askservice.com";
  const platformVat = global?.vat_number || "FRXX123456789";

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${invoiceNumber}.pdf"`,
  );

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const contentLeft = 40;
  const contentRight = pageWidth - 40;
  const contentWidth = contentRight - contentLeft;
  const primaryColor = "#111827";
  const mutedColor = "#6B7280";
  const lightBorder = "#E5E7EB";
  const lightFill = "#F9FAFB";

  const formatEuro = (value) => {
    const number = Number(value || 0);
    return `${number.toFixed(2).replace(".", ".")} ${currency}`;
  };

  const drawSectionBox = (x, y, w, h, title) => {
    doc.roundedRect(x, y, w, h, 6).fillAndStroke("#FFFFFF", lightBorder);
    doc
      .fillColor(primaryColor)
      .font("Helvetica-Bold")
      .fontSize(10)
      .text(title, x + 12, y + 10);
  };

  doc.rect(0, 0, pageWidth, 96).fill(primaryColor);
  doc
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(24)
    .text("FACTURE", contentLeft, 30);
  doc
    .font("Helvetica")
    .fontSize(11)
    .text(`N° ${invoiceNumber}`, contentLeft, 63)
    .text(`Date d'emission: ${issueDate}`, contentLeft + 180, 63);

  doc.fillColor(primaryColor);
  let y = 120;

  const colGap = 16;
  const boxWidth = (contentWidth - colGap) / 2;
  const boxHeight = 112;
  drawSectionBox(contentLeft, y, boxWidth, boxHeight, "PLATEFORME");
  drawSectionBox(
    contentLeft + boxWidth + colGap,
    y,
    boxWidth,
    boxHeight,
    "CLIENT",
  );

  doc.font("Helvetica").fontSize(10).fillColor(primaryColor);
  doc
    .text(platformName, contentLeft + 12, y + 32)
    .fillColor(mutedColor)
    .text(`Email: ${platformEmail}`, contentLeft + 12, y + 50, {
      width: boxWidth - 24,
    })
    .text(`TVA: ${platformVat}`, contentLeft + 12, y + 66, {
      width: boxWidth - 24,
    });

  doc.fillColor(primaryColor);
  doc
    .text(clientName, contentLeft + boxWidth + colGap + 12, y + 32, {
      width: boxWidth - 24,
    })
    .fillColor(mutedColor)
    .text(
      `Adresse: ${clientAddress || "-"}`,
      contentLeft + boxWidth + colGap + 12,
      y + 50,
      {
        width: boxWidth - 24,
      },
    )
    .text(`SIRET: ${clientSiret}`, contentLeft + boxWidth + colGap + 12, y + 82, {
      width: boxWidth - 24,
    });

  y += boxHeight + 24;

  const tableX = contentLeft;
  const tableY = y;
  const tableW = contentWidth;
  const headerH = 30;
  const rowH = 40;

  doc
    .roundedRect(tableX, tableY, tableW, headerH + rowH, 6)
    .stroke(lightBorder);
  doc.roundedRect(tableX, tableY, tableW, headerH, 6).fill(lightFill);
  doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(9);

  const c1 = tableX + 12;
  const c2 = tableX + tableW * 0.58;
  const c3 = tableX + tableW * 0.7;
  const c4 = tableX + tableW * 0.82;
  doc.text("DESCRIPTION", c1, tableY + 10);
  doc.text("QTE", c2, tableY + 10);
  doc.text("PRIX HT", c3, tableY + 10);
  doc.text("TOTAL HT", c4, tableY + 10);

  const rowY = tableY + headerH + 12;
  doc.font("Helvetica").fontSize(10).fillColor(primaryColor);
  doc.text(`Pack ${creditsAdded} credits (${packageName})`, c1, rowY, {
    width: c2 - c1 - 12,
  });
  doc.text("1", c2, rowY);
  doc.text(formatEuro(totalHt), c3, rowY);
  doc.text(formatEuro(totalHt), c4, rowY);

  y = tableY + headerH + rowH + 22;

  const totalsW = 220;
  const totalsX = contentRight - totalsW;
  const totalsY = y;
  doc
    .roundedRect(totalsX, totalsY, totalsW, 94, 6)
    .fillAndStroke("#FFFFFF", lightBorder);
  doc.font("Helvetica").fontSize(10).fillColor(primaryColor);
  doc.text("Total HT", totalsX + 12, totalsY + 14);
  doc.text(formatEuro(totalHt), totalsX + totalsW - 90, totalsY + 14, {
    width: 78,
    align: "right",
  });
  doc.text(`TVA (${Math.round(tvaRate * 100)}%)`, totalsX + 12, totalsY + 37);
  doc.text(formatEuro(tvaAmount), totalsX + totalsW - 90, totalsY + 37, {
    width: 78,
    align: "right",
  });
  doc
    .moveTo(totalsX + 12, totalsY + 59)
    .lineTo(totalsX + totalsW - 12, totalsY + 59)
    .stroke(lightBorder);
  doc.font("Helvetica-Bold");
  doc.text("Total TTC", totalsX + 12, totalsY + 68);
  doc.text(formatEuro(totalTtc), totalsX + totalsW - 90, totalsY + 68, {
    width: 78,
    align: "right",
  });

  const metaY = totalsY + 114;
  drawSectionBox(contentLeft, metaY, boxWidth, 88, "DETAILS");
  drawSectionBox(contentLeft + boxWidth + colGap, metaY, boxWidth, 88, "PAIEMENT");

  doc.font("Helvetica").fontSize(10).fillColor(mutedColor);
  doc
    .text(`Credits ajoutes: ${creditsAdded}`, contentLeft + 12, metaY + 34)
    .text(`Prix / credit: ${formatEuro(pricePerCredit)}`, contentLeft + 12, metaY + 52)
    .text(
      `Transaction: ${tx.transaction_number || tx._id?.toString() || "-"}`,
      contentLeft + 12,
      metaY + 70,
      {
        width: boxWidth - 24,
      },
    );

  doc.fillColor(mutedColor);
  doc
    .text(
      `Methode: ${String(paymentMethod).toUpperCase()}`,
      contentLeft + boxWidth + colGap + 12,
      metaY + 34,
    )
    .text(
      `Statut: ${paymentStatus.charAt(0).toUpperCase()}${paymentStatus.slice(1)}`,
      contentLeft + boxWidth + colGap + 12,
      metaY + 52,
    )
    .text(`Devise: ${currency}`, contentLeft + boxWidth + colGap + 12, metaY + 70);

  doc
    .fillColor("#9CA3AF")
    .font("Helvetica")
    .fontSize(9)
    .text(
      "Cette facture est generee automatiquement pour l'achat de credits.",
      contentLeft,
      pageHeight - 44,
      { width: contentWidth, align: "center" },
    );

  doc.end();
}
