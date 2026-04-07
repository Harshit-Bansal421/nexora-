import { v2 as cloudinary } from "cloudinary";
import ApiError from "../utils/ApiError.js";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadUserImage_cloud = async (localfilePath, folder, type = "image") => {
  try {
    if (!localfilePath) {
      throw new ApiError(400, "File path is missing");
    }

    let options = {
      folder,
      resource_type: "auto",
    };

    // 🔥 Light compression (not aggressive)
    if (type === "image") {
      options.transformation = [
        {
          quality: "auto:good", // balanced quality
          fetch_format: "auto",
          width: 1200, // don't shrink too much
          crop: "limit",
        },
      ];
    }

    if (type === "video") {
      options.transformation = [
        {
          quality: "auto", // not too low
          width: 1080,
          crop: "limit",
        },
      ];
    }

    const response = await cloudinary.uploader.upload(localfilePath, options);
    try {
      if (fs.existsSync(localfilePath)) {
        fs.unlinkSync(localfilePath);
      }
    } catch (removeErr) {
      console.log("Error removing local file:", removeErr);
    }
    return response;
  } catch (error) {
    try {
      if (fs.existsSync(localfilePath)) {
        fs.unlinkSync(localfilePath);
      }
    } catch (removeErr) {
      console.log("Error removing local file:", removeErr);
    }
    throw new ApiError(500, "image upload at cloudinary failed");
  }
};

const getOptimizedImage =(publicId) => {
  return cloudinary.url(publicId, {
    transformation: [
      {
        quality: "auto",
        fetch_format: "auto",
        width: 500,
        crop: "fill",
      },
    ],
  });
};

const getOptimizedVideo = (publicId) => {
  return cloudinary.url(publicId, {
    resource_type: "video",
    transformation: [
      {
        quality: "auto:low",
        width: 720,
        crop: "limit",
      },
    ],
  });
};

const deleteFromCloudinary = async (publicId, resourceType = "image") => {
  try {
    if (!publicId) {
      throw new ApiError(400, "Public ID is required");
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType, // IMPORTANT for videos
    });

    // console.log("Cloudinary delete result:", result);

    if (result.result !== "ok" && result.result !== "not found") {
      throw new ApiError(500, "Failed to delete file from Cloudinary");
    }

    return result;

  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new ApiError(500, "Error deleting file from Cloudinary");
  }
};

export { uploadUserImage_cloud, getOptimizedImage, getOptimizedVideo, deleteFromCloudinary };
