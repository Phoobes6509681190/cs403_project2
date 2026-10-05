const Inspection = require("../models/Inspection");
const Asset = require("../models/Asset");
const User = require("../models/User");
const mongoose = require("mongoose");

const inspectionStatuses = ["normal", "damaged", "lost", "disposed"];

const isAdmin = (req) => req.user.role === "admin";

const canAccessInspection = (inspection, req) =>
  isAdmin(req) ||
  inspection.committee.some(
    (memberId) => String(memberId) === String(req.user.userId)
  );

const findInspection = async (id, res) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ success: false, message: "Invalid inspection id" });
    return null;
  }

  const inspection = await Inspection.findById(id);
  if (!inspection) {
    res.status(404).json({ success: false, message: "Inspection not found" });
    return null;
  }

  return inspection;
};

exports.createInspection = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { name, fiscalYear } = req.body;

    if (!name || !fiscalYear) {
      return res.status(400).json({
        success: false,
        message: "name and fiscalYear are required"
      });
    }

    const assets = await Asset.find({ isDeleted: { $ne: true } }).select("_id").lean();
    const inspection = await Inspection.create({
      name,
      fiscalYear,
      status: "draft",
      createdBy: req.user.userId,
      items: assets.map(({ _id }) => ({ asset: _id }))
    });

    res.status(201).json({
      success: true,
      message: "Inspection created successfully",
      inspection
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getInspections = async (req, res) => {
  try {
    const filter = isAdmin(req) ? {} : { committee: req.user.userId };
    const inspections = await Inspection.find(filter)
      .select("name fiscalYear status committee startedAt closedAt createdAt updatedAt")
      .populate("committee", "name username")
      .sort({ createdAt: -1 });

    res.json({ success: true, inspections });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInspection = async (req, res) => {
  try {
    const inspection = await findInspection(req.params.id, res);
    if (!inspection) return;

    if (!canAccessInspection(inspection, req)) {
      return res.status(403).json({ success: false, message: "Not assigned to this inspection" });
    }

    await inspection.populate([
      { path: "committee", select: "name username role" },
      { path: "items.asset", select: "assetCode name category location status" },
      { path: "items.inspectedBy", select: "name username" }
    ]);

    res.json({ success: true, inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setCommittee = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const inspection = await findInspection(req.params.id, res);
    if (!inspection) return;
    if (inspection.status === "closed") {
      return res.status(400).json({ success: false, message: "Inspection is already closed" });
    }

    const { committee } = req.body;
    if (!Array.isArray(committee) || committee.length === 0 || committee.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: "committee must contain at least one valid user id" });
    }

    const committeeIds = [...new Set(committee.map(String))];
    const users = await User.find({ _id: { $in: committeeIds } }).select("_id");
    if (users.length !== committeeIds.length) {
      return res.status(400).json({ success: false, message: "One or more committee members were not found" });
    }

    inspection.committee = users.map((user) => user._id);
    inspection.status = "in_progress";
    inspection.startedAt = inspection.startedAt || new Date();
    await inspection.save();

    res.json({ success: true, message: "Committee assigned successfully", inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recordInspectionItem = async (req, res) => {
  try {
    const inspection = await findInspection(req.params.id, res);
    if (!inspection) return;
    if (!canAccessInspection(inspection, req)) {
      return res.status(403).json({ success: false, message: "Not assigned to this inspection" });
    }
    if (inspection.status !== "in_progress") {
      return res.status(400).json({ success: false, message: "Inspection is not in progress" });
    }

    const { assetId, status, note } = req.body;
    if (!mongoose.isValidObjectId(assetId)) {
      return res.status(400).json({ success: false, message: "A valid assetId is required" });
    }
    if (!inspectionStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid inspection status" });
    }
    if (note !== undefined && typeof note !== "string") {
      return res.status(400).json({ success: false, message: "note must be a string" });
    }

    const item = inspection.items.find(({ asset }) => String(asset) === String(assetId));
    if (!item) {
      return res.status(404).json({ success: false, message: "Asset is not part of this inspection" });
    }

    item.status = status;
    item.note = note?.trim() || "";
    item.inspectedBy = req.user.userId;
    item.inspectedAt = new Date();
    await inspection.save();

    res.json({ success: true, message: "Inspection result recorded", item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getInspectionProgress = async (req, res) => {
  try {
    const inspection = await findInspection(req.params.id, res);
    if (!inspection) return;
    if (!canAccessInspection(inspection, req)) {
      return res.status(403).json({ success: false, message: "Not assigned to this inspection" });
    }

    const inspectedItems = inspection.items.filter(({ inspectedAt }) => inspectedAt);
    const byStatus = inspectionStatuses.reduce((counts, status) => {
      counts[status] = inspectedItems.filter((item) => item.status === status).length;
      return counts;
    }, {});
    const total = inspection.items.length;

    res.json({
      success: true,
      progress: {
        inspectionId: inspection._id,
        status: inspection.status,
        total,
        inspected: inspectedItems.length,
        remaining: total - inspectedItems.length,
        percentage: total === 0 ? 0 : Math.round((inspectedItems.length / total) * 100),
        byStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.closeInspection = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const inspection = await findInspection(req.params.id, res);
    if (!inspection) return;
    if (inspection.status === "closed") {
      return res.status(400).json({ success: false, message: "Inspection is already closed" });
    }
    if (inspection.status !== "in_progress") {
      return res.status(400).json({ success: false, message: "Inspection must be in progress before closing" });
    }
    if (inspection.items.length === 0) {
      return res.status(400).json({ success: false, message: "Inspection has no assets to inspect" });
    }

    const inspectedCount = inspection.items.filter(({ inspectedAt }) => inspectedAt).length;
    if (inspectedCount !== inspection.items.length) {
      return res.status(400).json({
        success: false,
        message: "All assets must be inspected before closing",
        remaining: inspection.items.length - inspectedCount
      });
    }

    inspection.status = "closed";
    inspection.closedAt = new Date();
    await inspection.save();

    res.json({ success: true, message: "Inspection closed successfully", inspection });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};