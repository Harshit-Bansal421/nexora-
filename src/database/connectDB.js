import mongoose from "mongoose";
import {DB_NAME} from "../constants.js"

const connectDB=async()=>{
  try{
    const databaseInstance=await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
    console.log("instance of database is",databaseInstance);
  }catch(error){
    console.log("error in connecting database",error.message);
    process.exit(1)
  }
}

export default connectDB