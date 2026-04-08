import mongoose from "mongoose";

const PageSchema = mongoose.Schema(
  {
    pageName:{
      type:String,
      required:true,
      trim:true,
      unique:[true,"page with this name already exist"]
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "page owner feild is required"],
    },
    pageDescription: {
      type: String,
      required: [true, "description feild is required"],
      minlength:[40,"minimum length of description is 40 words"],
      maxlength:[300,"maximum length of description is 300 words"]
    },
    moderators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    title:[{//page category / topic.
      type:String,
      required:true
    }],
    pageProfileImage:{
      type:String,
      required:true
    },
    members:[
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    type: {
      type: String,
      enum: {
        values: ['open', 'private'],
        message: 'Type must be open or private',
      },
      default: 'open',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

PageSchema.virtual("membersCount").get(function(){
  return this.members.length;
})

PageSchema.virtual("moderatorsCount").get(function(){
  return this.moderators.length;
})


PageSchema.index({owner:1})
PageSchema.index({type:1,title:1})
PageSchema.index({createdAt:-1})
PageSchema.index({membersCount:1,createdAt:1})
PageSchema.index({ name: 'text', description: 'text' })  // search pages


export const Page = mongoose.model("Page", PageSchema);
