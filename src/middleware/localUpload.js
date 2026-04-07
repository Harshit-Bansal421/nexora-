import multer from "multer";
import path from "path";
import ApiError from "../utils/ApiError.js";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve("public/temp"));
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

export const upload = {
  avatarUpload: (name = "profileImage") => {
    return avatarMulter.single(name);
  },
  postUpload: (ImageName, videoName) => {
    return postMulter.fields([
      { name: ImageName, maxCount: 3 },
      { name: videoName, maxCount: 2 },
    ]);
  },
};
