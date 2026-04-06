import { v2 as cloudinary } from "cloudinary";
import ApiError from "../utils/ApiError.js";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadUserImage_cloud = async (localfilePath, folder) => {
  try {
    if (!localfilePath) {
      throw new ApiError(400, "File path is missing");
    }
    const response = await cloudinary.uploader.upload(localfilePath, {
      folder: folder,
      resource_type: "auto",
    });
    try {
      if (fs.existsSync(localfilePath)) {
        fs.unlinkSync(localfilePath);
      }
    } catch (removeErr) {
      console.log("Error removing local file:", removeErr);
    }
    console.log(response);
    
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

export { uploadUserImage_cloud };
