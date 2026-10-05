const Asset = require("../models/Asset");
const AssetHistory = require("../models/AssetHistory");
const ExcelJS = require("exceljs");
const mongoose = require("mongoose");
const statusMapping = require("../utils/statusMapping");
const validStatuses = new Set(["normal", "damaged", "lost", "disposed"]);

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/assets
exports.getAssets = async (req, res) => {
  try {
    const { q, status, location, budgetSource, minPrice, maxPrice } = req.query;
    const filter = { isDeleted: { $ne: true } };

    if (status) filter.status = status;
    if (location) filter.location = location;
    if (budgetSource) filter.budgetSource = budgetSource;
    if (q) {
      if (typeof q !== "string") {
        return res.status(400).json({ success: false, message: "q must be a string" });
      }
      const keyword = new RegExp(escapeRegex(q), "i");
      filter.$or = ["assetCode", "name", "category", "location", "responsiblePerson"]
        .map((field) => ({ [field]: keyword }));
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const min = minPrice === undefined ? 0 : Number(minPrice);
      const max = maxPrice === undefined ? Number.MAX_VALUE : Number(maxPrice);
      if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < min) {
        return res.status(400).json({ success: false, message: "Invalid price range" });
      }
      filter.price = { $gte: min, $lte: max };
    }

    const assets = await Asset.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: assets.length,
      data: assets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// POST /api/assets
exports.createAsset = async (req, res) => {
  try {
    const asset = await Asset.create(req.body);

    res.status(201).json({
      success: true,
      message: "Asset created successfully",
      data: asset
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// PUT /api/assets/:id
exports.updateAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found"
      });
    }

    const editableFields = [
      "assetCode", "name", "category", "location", "purchaseDate", "price",
      "budgetSource", "description", "responsiblePerson", "status"
    ];
    const trackedFields = new Set(["status", "location", "responsiblePerson", "budgetSource"]);
    const changes = [];

    editableFields.forEach((field) => {
      if (req.body[field] === undefined || req.body[field] === asset[field]) return;
      if (trackedFields.has(field)) {
        changes.push({ field, oldValue: asset[field], newValue: req.body[field] });
      }
      asset[field] = req.body[field];
    });

    await asset.save();

    // บันทึก History เฉพาะเมื่อมีการเปลี่ยนแปลง
    if (changes.length > 0) {
      await AssetHistory.create({
        asset: asset._id,
        changedBy: req.user.username,
        changes
      });
    }

    res.json({
      success: true,
      message: "Asset updated successfully",
      data: asset
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};


// DELETE /api/assets/:id
exports.deleteAsset = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found"
      });
    }

    asset.isDeleted = true;

    await asset.save();

    res.json({
      success: true,
      message: "Asset deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// GET /api/assets/search
exports.searchAssets = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search keyword is required"
      });
    }

    const assets = await Asset.find({
      isDeleted: false,
      $or: [
        {
          assetCode: {
            $regex: escapeRegex(q),
            $options: "i"
          }
        },
        {
          name: {
            $regex: escapeRegex(q),
            $options: "i"
          }
        },
        {
          category: {
            $regex: escapeRegex(q),
            $options: "i"
          }
        },
        {
          location: {
            $regex: escapeRegex(q),
            $options: "i"
          }
        },
        {
          responsiblePerson: {
            $regex: escapeRegex(q),
            $options: "i"
          }
        }
      ]
    });

    res.json({
      success: true,
      count: assets.length,
      data: assets
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// GET /api/assets/:id/history
exports.getAssetHistory = async (req, res) => {
  try {
    const asset = await Asset.findOne({
      _id: req.params.id,
      isDeleted: false
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        message: "Asset not found"
      });
    }

    const history = await AssetHistory.find({
      asset: asset._id
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
exports.importAssets = async (req, res) => {
  try {
    // ตรวจว่ามีไฟล์หรือไม่
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Excel file is required"
      });
    }

    const rows = await readImportRows(req.file.buffer);

    const imported = [];
    const unmapped = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const assetCode = row.assetCode;
        const name = row.name;
        const category = row.category;
        const location = row.location;
        const oldStatus = row.status;

        // ตรวจข้อมูลจำเป็น
        if (!assetCode || !name) {
          errors.push({
            row: i + 2,
            message: "assetCode and name are required"
          });

          continue;
        }

        // Mapping status
        const newStatus =
          statusMapping[oldStatus];

        // ถ้า Map ไม่ได้
        if (!newStatus) {
          unmapped.push({
            row: i + 2,
            assetCode,
            originalStatus: oldStatus
          });

          continue;
        }

        // หา Asset เดิมจาก assetCode
        let asset = await Asset.findOne({
          assetCode
        });

        if (asset) {
          // เก็บค่าเดิมจาก Excel
          asset.originalStatus = oldStatus;

          // เปลี่ยนเป็นค่าที่ Map แล้ว
          asset.status = newStatus;

          if (name !== undefined) {
            asset.name = name;
          }

          if (category !== undefined) {
            asset.category = category;
          }

          if (location !== undefined) {
            asset.location = location;
          }

          if (row.price !== undefined) {
            asset.price = row.price;
          }

          if (row.description !== undefined) {
            asset.description = row.description;
          }

          if (row.responsiblePerson !== undefined) {
            asset.responsiblePerson =
              row.responsiblePerson;
          }

          await asset.save();

        } else {
          // ถ้ายังไม่มี Asset ให้สร้างใหม่
          asset = await Asset.create({
            assetCode,
            name,
            category,
            location,
            purchaseDate: row.purchaseDate,
            price: row.price,
            status: newStatus,
            originalStatus: oldStatus,
            description: row.description,
            responsiblePerson: row.responsiblePerson
          });
        }

        imported.push({
          row: i + 2,
          assetCode,
          originalStatus: oldStatus,
          status: newStatus
        });

      } catch (error) {
        errors.push({
          row: i + 2,
          assetCode: row.assetCode,
          message: error.message
        });
      }
    }

    res.json({
      success: true,
      message: "Excel import completed",
      totalRows: rows.length,
      importedCount: imported.length,
      unmappedCount: unmapped.length,
      errorCount: errors.length,
      imported,
      unmapped,
      errors
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const readImportRows = (buffer) => {
  return (async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("Excel workbook has no sheets");

    const headers = worksheet.getRow(1).values.slice(1).map((value) => String(value || "").trim());
    const rows = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const source = {};
      headers.forEach((header, index) => {
        if (header) source[header] = worksheet.getRow(rowNumber).getCell(index + 1).value ?? "";
      });
      if (Object.values(source).some((value) => value !== "")) rows.push(source);
    }
    return rows;
  })();
};

const normalizeImportRows = (rows) => {
  const seenCodes = new Set();
  return rows.map((source, index) => {
    const assetCode = String(source.assetCode || "").trim();
    const originalStatus = String(source.status || "").trim();
    const originalBudgetSource = String(source.budgetSource || source.budget || "").trim();
    const duplicateInFile = assetCode !== "" && seenCodes.has(assetCode);
    if (assetCode) seenCodes.add(assetCode);

    return {
      row: index + 2,
      assetCode,
      name: String(source.name || "").trim(),
      category: String(source.category || "").trim(),
      location: String(source.location || "").trim(),
      purchaseDate: source.purchaseDate || undefined,
      price: source.price === "" || source.price === undefined ? undefined : Number(source.price),
      status: statusMapping[originalStatus] || (validStatuses.has(originalStatus) ? originalStatus : ""),
      originalStatus,
      budgetSource: originalBudgetSource,
      originalBudgetSource,
      description: String(source.description || "").trim(),
      responsiblePerson: String(source.responsiblePerson || "").trim(),
      duplicateInFile
    };
  });
};

exports.previewAssetImport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Excel file is required" });
    }

    const rows = normalizeImportRows(readImportRows(req.file.buffer));
    const codes = [...new Set(rows.map((row) => row.assetCode).filter(Boolean))];
    const existingAssets = await Asset.find({ assetCode: { $in: codes } })
      .select("assetCode isDeleted")
      .lean();
    const existingCodes = new Map(existingAssets.map((asset) => [asset.assetCode, asset.isDeleted]));
    const preview = rows.map((row) => ({
      ...row,
      exists: existingCodes.has(row.assetCode),
      previouslyDeleted: existingCodes.get(row.assetCode) === true,
      validationErrors: [
        ...(!row.assetCode ? ["assetCode is required"] : []),
        ...(!row.name ? ["name is required"] : []),
        ...(!row.category ? ["category is required"] : []),
        ...(!row.location ? ["location is required"] : []),
        ...(row.price !== undefined && (!Number.isFinite(row.price) || row.price < 0) ? ["price must be a non-negative number"] : []),
        ...(row.duplicateInFile ? ["assetCode is duplicated in this file"] : []),
        ...(existingCodes.get(row.assetCode) === true ? ["assetCode belongs to a soft-deleted asset"] : [])
      ]
    }));

    res.json({
      success: true,
      totalRows: preview.length,
      rows: preview,
      unmapped: preview.filter((row) => !row.status).map(({ row, assetCode, originalStatus }) => ({ row, assetCode, originalStatus }))
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.confirmAssetImport = async (req, res) => {
  try {
    const { rows, statusMappings = {} } = req.body;
    if (!Array.isArray(rows) || !statusMappings || typeof statusMappings !== "object" || Array.isArray(statusMappings)) {
      return res.status(400).json({ success: false, message: "rows and statusMappings are required" });
    }

    const imported = [];
    const errors = [];
    for (const row of rows) {
      const status = statusMappings[String(row.row)] || row.status;
      const rowErrors = [...(Array.isArray(row.validationErrors) ? row.validationErrors : [])];
      if (!row.assetCode || !row.name || !row.category || !row.location) rowErrors.push("Required asset fields are missing");
      if (!validStatuses.has(status)) rowErrors.push("A valid mapped status is required");
      if (row.duplicateInFile) rowErrors.push("assetCode is duplicated in this file");
      if (row.previouslyDeleted) rowErrors.push("assetCode belongs to a soft-deleted asset");
      if (row.price !== undefined && (!Number.isFinite(Number(row.price)) || Number(row.price) < 0)) rowErrors.push("Invalid price");
      if (rowErrors.length) {
        errors.push({ row: row.row, assetCode: row.assetCode, message: [...new Set(rowErrors)].join("; ") });
        continue;
      }

      try {
        const fields = {
          name: row.name,
          category: row.category,
          location: row.location,
          purchaseDate: row.purchaseDate || undefined,
          price: row.price === "" ? undefined : row.price,
          status,
          originalStatus: row.originalStatus,
          budgetSource: row.budgetSource,
          originalBudgetSource: row.originalBudgetSource,
          description: row.description,
          responsiblePerson: row.responsiblePerson
        };
        const asset = await Asset.findOne({ assetCode: row.assetCode });
        if (asset) {
          Object.assign(asset, fields);
          await asset.save();
        } else {
          await Asset.create({ assetCode: row.assetCode, ...fields });
        }
        imported.push({ row: row.row, assetCode: row.assetCode, originalStatus: row.originalStatus, status });
      } catch (error) {
        errors.push({ row: row.row, assetCode: row.assetCode, message: error.message });
      }
    }

    res.json({
      success: errors.length === 0,
      message: "Excel import completed",
      importedCount: imported.length,
      errorCount: errors.length,
      imported,
      errors
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAssetById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid asset id" });
    }
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
    if (!asset) return res.status(404).json({ success: false, message: "Asset not found" });
    res.json({ success: true, data: asset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadImportTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Assets");
    worksheet.addRow(["assetCode", "name", "category", "location", "purchaseDate", "price", "status", "budgetSource", "description", "responsiblePerson"]);
    worksheet.addRow(["ASSET-001", "ตัวอย่างครุภัณฑ์", "อุปกรณ์สำนักงาน", "ห้อง 101", "2026-01-15", 12000, "ปกติ", "งบกลาง", "รายละเอียด", "ผู้รับผิดชอบ"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=aimslog-import-template.xlsx"
    });
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};