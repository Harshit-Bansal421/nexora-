import ApiError from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Post } from "../models/Post.model.js";

export const isOwner = asyncHandler(async (req, res, next) => {
  //first get data from url as well as from req body
  //check whether the data is even is present or not

  const post_id = req.params.post_id;
  if (!post_id) throw new ApiError(400, "post id is missing");

  const user_id = req.user._id;
  if (!user_id) throw new ApiError(400, "user id is missing");

  //if it present then validate the data of post from url and we dont have to verify the user authenticity as it is already done in previous middleware
  // const post = await Post.aggregate([
  //   {
  //     $match: {
  //       _id: new mongoose.Types.ObjectId(post_id),
  //     },
  //   },
  //   {
  //     $lookup: {
  //       from: "users",
  //       let: { ownerid: "$owner" },
  //       pipeline: [
  //         {
  //           $match: {
  //             $expr: { $eq: ["$_id", "$$ownerid"] },
  //           },
  //         },
  //         {
  //           $project: {
  //             _id: 1,
  //             username: 1,
  //             profileImage: 1,
  //           },
  //         },
  //       ],
  //       as: "ownerInfo",
  //     },
  //   },
  //   {
  //     $unwind: {
  //       path: "ownerInfo",
  //       preserveNullAndEmptyArrays: true,
  //     },
  //   },
  // ]);
  const post=await Post.findById(post_id);
  if (!post) throw new ApiError(400,"no post exist with this post id");
  // postdata=post[0];//as aggregate pipeline return an array

  //then check the user is the owner or have authority to modify or delete it
  if(post.owner.toString()!==user_id.toString()) throw new ApiError(400,"u dont have authorisation to perform this action");

  //if it has then pass it to next
  req.post=post;
  next();
});
