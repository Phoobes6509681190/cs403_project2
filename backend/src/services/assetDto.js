const { STATUSES } = require("../constants/status");

// รูปแบบข้อมูลที่ส่งให้ Frontend (ชื่อฟิลด์ตรงกับที่หน้า Asset List/Detail ใช้อยู่)
function toAssetDto(a) {
  return {
    id: String(a._id),
    code: a.assetCode,
    codeParts: a.codeParts || null,
    name: a.name,
    model: a.model || "",
    brand: a.brand || "",
    cat: a.category || "",
    room: a.location?.label || "",
    location: a.location || {},
    owner: a.holderName || "",
    holderUser: a.holderUser ? String(a.holderUser) : null,
    budget: a.budget || "ไม่ระบุ",
    price: a.price ?? null,
    status: a.status,
    acquiredAt: a.acquiredAt || null,
    lastInspectedAt: a.lastInspectedAt || null,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

// แปลงข้อมูลจากฟอร์ม Frontend -> ฟิลด์ใน Model (รับเฉพาะฟิลด์ที่อนุญาต)
function fromAssetInput(body = {}) {
  const out = {};
  const str = (v) => (v === undefined || v === null ? undefined : String(v).trim());
  if (body.code !== undefined) out.assetCode = str(body.code);
  if (body.name !== undefined) out.name = str(body.name);
  if (body.model !== undefined) out.model = str(body.model);
  if (body.brand !== undefined) out.brand = str(body.brand);
  if (body.cat !== undefined) out.category = str(body.cat);
  if (body.owner !== undefined) out.holderName = str(body.owner);
  if (body.holderUser !== undefined) out.holderUser = body.holderUser || null;
  if (body.budget !== undefined) out.budget = str(body.budget);
  if (body.status !== undefined) out.status = str(body.status);
  if (body.price !== undefined) out.price = body.price === "" || body.price === null ? undefined : Number(body.price);
  if (body.acquiredAt !== undefined) out.acquiredAt = body.acquiredAt || undefined;
  if (body.room !== undefined) out.locationLabel = str(body.room);
  // ฟอร์มมีช่อง "สถานที่" ช่องเดียว (room) — ถ้าผู้ใช้แก้ช่องนั้น ให้ยึดค่านั้นแทน location เดิม
  const roomEdited = body.room !== undefined && body.room !== body.location?.label;
  if (!roomEdited && body.location && typeof body.location === "object") {
    out.location = {
      building: str(body.location.building),
      floor: str(body.location.floor),
      room: str(body.location.room),
      label: str(body.location.label)
    };
  }
  return out;
}

const FIELD_LABELS = { status: "สถานะ", location: "สถานที่", holderName: "ผู้ถือครอง" };

function historySummary(h) {
  if (h.action === "create") return "เพิ่มครุภัณฑ์เข้าระบบ";
  if (h.action === "import") return "นำเข้าจากไฟล์ Excel";
  if (h.action === "delete") return "ลบครุภัณฑ์ (ย้ายไปถังขยะ)";
  if (h.action === "restore") return "กู้คืนจากถังขยะ";
  return (h.changes || [])
    .map((c) => {
      const fmt = (v) => (c.field === "status" ? STATUSES[v]?.label || v : v) || "—";
      return `${FIELD_LABELS[c.field] || c.field}: ${fmt(c.oldValue)} → ${fmt(c.newValue)}`;
    })
    .join(", ");
}

function toHistoryDto(h) {
  return {
    id: String(h._id),
    action: h.action,
    summary: historySummary(h),
    changes: h.changes,
    by: h.changedByName || "",
    at: h.createdAt
  };
}

module.exports = { toAssetDto, fromAssetInput, toHistoryDto };
