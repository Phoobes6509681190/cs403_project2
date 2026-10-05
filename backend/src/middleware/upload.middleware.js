const multer = require("multer");

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = [".xlsx"];

    const fileExtension =
      "." + file.originalname.split(".").pop().toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return cb(
        new Error("Only .xlsx Excel files are allowed")
      );
    }

    cb(null, true);
  }
});

module.exports = upload;