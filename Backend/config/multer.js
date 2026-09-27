import multer from "multer";

const storage = multer.diskStorage({});

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const onlyTypes = (test, message) => (req, file, cb) => {
  if (test(file.mimetype)) return cb(null, true);
  const error = new Error(message);
  error.status = 400;
  cb(error);
};

export const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: onlyTypes((type) => type.startsWith("image/"), "Only image files are allowed."),
});

export const uploadPdf = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: onlyTypes((type) => type === "application/pdf", "Only PDF files are allowed."),
});
