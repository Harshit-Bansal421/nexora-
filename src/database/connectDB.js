import mongoose from "mongoose";
import {DB_NAME} from "../constants.js"
import { OTP } from "../models/Otp.model.js";

const connectDB=async()=>{
  try{
    const databaseInstance=await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
    await OTP.syncIndexes();
    console.log("db connected");
  }catch(error){
    console.log("error in connecting database",error.message);
    process.exit(1)
  }
}

export default connectDB