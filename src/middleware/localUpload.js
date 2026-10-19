import multer from "multer";
import { mkdir, unlink } from "node:fs/promises";
import os from "node:os";
import path from "path";
import ApiError from "../utils/ApiError.js";

const tempDirectory = path.join(os.tmpdir(), "nexora-uploads");
await mkdir(tempDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDirectory);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); //->allow to upload file
  } else {
    cb(new ApiError(400, "file type is diffrent"), false); //doesnot allow uploading file
  }
};

const postMulter = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 5,
  },
});

const avatarMulter = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true); //->allow to upload file
    } else {
      cb(new ApiError(400, "file type is diffrent"), false); //doesnot allow uploading file
    }
  },
  limits: {
    fileSize: 4 * 1024 * 1024,
    files: 1,
  },
});

const removeUploadedFiles = async (files = []) => {
  const results = await Promise.allSettled(
    files.filter(Boolean).map((file) => unlink(file.path)),
  );
  for (const result of results) {
    if (result.status === "rejected" && result.reason.code !== "ENOENT") {
      console.error("Unable to remove temporary upload:", result.reason);
    }
  }
};

const withCleanup = (middleware) => (req, res, next) => {
  middleware(req, res, (error) => {
    const files = [
      ...(req.file ? [req.file] : []),
      ...Object.values(req.files || {}).flat(),
    ];
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      void removeUploadedFiles(files);
    };
    res.once("finish", cleanup);
    res.once("close", cleanup);
    next(error);
  });
};

export const upload = {
  avatarUpload: (name = "profileImage") => {
    return withCleanup(avatarMulter.single(name));
  },
  postUpload: (ImageName, videoName) => {
    return withCleanup(postMulter.fields([
      { name: ImageName, maxCount: 3 },
      { name: videoName, maxCount: 1 },
    ]));
  },
};
