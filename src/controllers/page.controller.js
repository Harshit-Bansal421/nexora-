import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import { Page } from "../models/Page.model.js";
import {
  uploadUserImage_cloud,
  getOptimizedImage,
  getOptimizedVideo,
  deleteFromCloudinary,
} from "../utils/Cloudinary.js";
import { Post } from "../models/Post.model.js";

const createPage = asyncHandler(async (req, res) => {
  //get the info from req.body
  const { pageName, pageDescription, title, type = "open" } = req.body;
  const pageProfileImage = req.file;
  const owner = req.user._id;

  //validate each of them
  if (!pageName || !pageDescription || !title)
    throw new ApiError(400, "Incomplete information for creating a page");
  if (!pageProfileImage)
    throw new ApiError(400, "Page profile image is required");
  const normalizedTitle = Array.isArray(title) ? title : [title];

  //if not then upload the images to cloudinary and get the public_id
  const cloudinaryresponse = await uploadUserImage_cloud(
    pageProfileImage.path,
    "nexora_pageImage",
    "image",
  );
  if (!cloudinaryresponse)
    throw new ApiError(500, "error in uploading image to cloudinary");

  //then create a entry in database
  try {
    const page = await Page.create({
      owner,
      pageName,
      pageDescription,
      title: normalizedTitle,
      type,
      pageProfileImage: cloudinaryresponse.public_id,
      moderators: [owner],
    });

    page.pageProfileImage= getOptimizedImage(page.pageProfileImage);

    //then create a object that u will be sending as the response
    res
      .status(201)
      .json(new ApiResponse(201, page, "page is created successfully"));
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(400, "Page with this name already exists");
    }

    throw error;
  }
});

const deletePost = asyncHandler(async (req, res) => {
  //get page_id from req.post
  const page_id = req.page._id;
  if (!page_id) throw new ApiResponse(404, "page id not found");
  const pageImage=req.page.pageProfileImage;
  //its is validated one so just deleted the page
  const deletedPage = await Page.findByIdAndDelete(page_id);
  if (!deletedPage) throw new ApiError(400, "error in deleting page");

  //delete file from cloudinary also
  if(pageImage) {
    const cloudinaryresponse=await deleteFromCloudinary(pageImage,"image");
    if(!cloudinaryresponse) throw new ApiError(400,"error in deleting files from cloudinary")
  }
  //also update all those post which includes this deleted page in their pages array
  const updatedpost = await Post.updateMany(
    { pages: page_id },
    { $pull: { pages: page_id } },
  );
  if(!updatedpost) throw new ApiError(400,"error in uploading post");

  res.status(200).json(new ApiResponse(200,"page deleted successfully"));
});

export { createPage, deletePost };
