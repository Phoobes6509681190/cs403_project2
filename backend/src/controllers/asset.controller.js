const Asset = require("../models/Asset");
const AssetHistory = require("../models/AssetHistory");

// GET /api/assets
exports.getAssets = async (req, res) => {
  try {
    const assets = await Asset.find({
      isDeleted: false
    }).sort({ createdAt: -1 });

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

    const changes = [];

    const fieldsToTrack = [
      "status",
      "location",
      "responsiblePerson"
    ];

    fieldsToTrack.forEach((field) => {
      if (
        req.body[field] !== undefined &&
        req.body[field] !== asset[field]
      ) {
        changes.push({
          field,
          oldValue: asset[field],
          newValue: req.body[field]
        });
      }
    });

    Object.assign(asset, req.body);

    await asset.save();

    // บันทึก History เฉพาะเมื่อมีการเปลี่ยนแปลง
    if (changes.length > 0) {
      await AssetHistory.create({
        asset: asset._id,
        changedBy:
          req.body.changedBy || "Unknown",
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
            $regex: q,
            $options: "i"
          }
        },
        {
          name: {
            $regex: q,
            $options: "i"
          }
        },
        {
          category: {
            $regex: q,
            $options: "i"
          }
        },
        {
          location: {
            $regex: q,
            $options: "i"
          }
        },
        {
          responsiblePerson: {
            $regex: q,
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