const fs = require("node:fs");
const path = require("node:path");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const Asset = require("../models/Asset");

const validStatuses = new Set(["normal", "damaged", "lost", "disposed"]);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildAssetFilter(query) {
  const filter = { isDeleted: { $ne: true } };
  if (query.status) {
    if (!validStatuses.has(query.status)) throw new Error("Invalid status filter");
    filter.status = query.status;
  }
  if (query.location) filter.location = query.location;
  if (query.budgetSource) filter.budgetSource = query.budgetSource;
  if (query.q) {
    if (typeof query.q !== "string") throw new Error("q must be a string");
    const keyword = new RegExp(escapeRegex(query.q), "i");
    filter.$or = ["assetCode", "name", "category", "location", "responsiblePerson"]
      .map((field) => ({ [field]: keyword }));
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const min = query.minPrice === undefined ? 0 : Number(query.minPrice);
    const max = query.maxPrice === undefined ? Number.MAX_VALUE : Number(query.maxPrice);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
      throw new Error("Invalid price range");
    }
    filter.price = { $gte: min, $lte: max };
  }
  return filter;
}

exports.getReportSummary = async (req, res) => {
  try {
    const match = { isDeleted: { $ne: true } };
    const valueExpression = { $sum: { $ifNull: ["$price", 0] } };
    const [totals, byStatus, byBudget] = await Promise.all([
      Asset.aggregate([{ $match: match }, { $group: { _id: null, count: { $sum: 1 }, value: valueExpression } }]),
      Asset.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 }, value: valueExpression } }, { $sort: { _id: 1 } }]),
      Asset.aggregate([{ $match: match }, { $group: { _id: { $ifNull: ["$budgetSource", "ไม่ระบุ"] }, count: { $sum: 1 }, value: valueExpression } }, { $sort: { _id: 1 } }])
    ]);

    res.json({
      success: true,
      summary: {
        totalAssets: totals[0]?.count || 0,
        totalValue: totals[0]?.value || 0,
        byStatus: byStatus.map(({ _id, count, value }) => ({ status: _id || "ไม่ระบุ", count, value })),
        byBudgetSource: byBudget.map(({ _id, count, value }) => ({ budgetSource: _id, count, value }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getReportDetail = async (req, res) => {
  try {
    const filter = buildAssetFilter(req.query);
    const assets = await Asset.find(filter).sort({ assetCode: 1 }).lean();
    res.json({ success: true, count: assets.length, data: assets });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

const toReportRows = (assets) => assets.map((asset) => ({
  "รหัสครุภัณฑ์": asset.assetCode,
  "ชื่อครุภัณฑ์": asset.name,
  "ประเภท": asset.category,
  "สถานที่": asset.location,
  "แหล่งงบประมาณ": asset.budgetSource || "ไม่ระบุ",
  "ราคา": asset.price ?? "",
  "สถานะ": asset.status,
  "ผู้รับผิดชอบ": asset.responsiblePerson || "",
  "รายละเอียด": asset.description || ""
}));

const reportHeaders = ["รหัสครุภัณฑ์", "ชื่อครุภัณฑ์", "ประเภท", "สถานที่", "แหล่งงบประมาณ", "ราคา", "สถานะ", "ผู้รับผิดชอบ", "รายละเอียด"];

function writeReportText(document, value, fontSize, thaiFont, latinFont) {
  const segments = String(value).match(/[\u0E00-\u0E7F]+|[^\u0E00-\u0E7F]+/g) || [""];
  segments.forEach((segment, index) => {
    const font = /[\u0E00-\u0E7F]/.test(segment) ? thaiFont : latinFont;
    document.font(font).fontSize(fontSize).text(segment, { continued: index < segments.length - 1 });
  });
}

exports.exportReport = async (req, res) => {
  try {
    const format = String(req.query.format || "").toLowerCase();
    if (!['excel', 'pdf'].includes(format)) {
      return res.status(400).json({ success: false, message: "format must be excel or pdf" });
    }

    const assets = await Asset.find(buildAssetFilter(req.query)).sort({ assetCode: 1 }).lean();
    const rows = toReportRows(assets);
    const date = new Date().toISOString().slice(0, 10);

    if (format === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Assets");
      worksheet.columns = reportHeaders.map((header, index) => ({
        header,
        key: header,
        width: [18, 28, 18, 22, 22, 14, 16, 24, 36][index]
      }));
      rows.forEach((row) => worksheet.addRow(row));
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      res.set({
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="aimslog-assets-${date}.xlsx"`
      });
      return res.send(buffer);
    }

    const configuredFont = process.env.REPORT_FONT_PATH && path.resolve(process.env.REPORT_FONT_PATH);
    const fontDirectory = path.resolve(__dirname, "../../node_modules/@fontsource/noto-sans-thai/files");
    const thaiFont = configuredFont && fs.existsSync(configuredFont)
      ? configuredFont
      : path.join(fontDirectory, "noto-sans-thai-thai-400-normal.woff2");
    const latinFont = configuredFont && fs.existsSync(configuredFont)
      ? configuredFont
      : path.join(fontDirectory, "noto-sans-thai-latin-400-normal.woff2");
    const document = new PDFDocument({ size: "A4", margin: 38, autoFirstPage: true });
    writeReportText(document, "AIMSlog Asset Report", 18, thaiFont, latinFont);
    document.moveDown(0.3);
    writeReportText(document, `Generated: ${date} | Assets: ${assets.length}`, 9, thaiFont, latinFont);
    document.moveDown();
    for (const asset of assets) {
      writeReportText(document, `${asset.assetCode} | ${asset.status || "unspecified"}`, 9, thaiFont, latinFont);
      writeReportText(document, asset.name, 11, thaiFont, latinFont);
      writeReportText(document, `ประเภท: ${asset.category} | สถานที่: ${asset.location}`, 8, thaiFont, latinFont);
      writeReportText(document, `แหล่งงบประมาณ: ${asset.budgetSource || "ไม่ระบุ"}`, 8, thaiFont, latinFont);
      writeReportText(document, `Price: ${asset.price ?? "-"}`, 8, thaiFont, latinFont);
      writeReportText(document, `ผู้รับผิดชอบ: ${asset.responsiblePerson || "ไม่ระบุ"}`, 8, thaiFont, latinFont);
      if (asset.description) writeReportText(document, `รายละเอียด: ${asset.description}`, 8, thaiFont, latinFont);
      document.moveDown(0.6);
    }

    const chunks = [];
    const buffer = await new Promise((resolve, reject) => {
      document.on("data", (chunk) => chunks.push(chunk));
      document.on("end", () => resolve(Buffer.concat(chunks)));
      document.on("error", reject);
      document.end();
    });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="aimslog-assets-${date}.pdf"`
    });
    res.send(buffer);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};