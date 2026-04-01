import dotenv from "dotenv";
dotenv.config({path: './.env'})//env should be configured during the server starting time

import app from "./app.js";
import connectDB from "./database/connectDB.js";

const PORT = process.env.PORT || 8000;

connectDB()
.then(()=>{

  app.on("error",(error)=>{
    console.log("error",error);
    throw error;
  })
  
  app.listen(PORT,()=>{
    console.log(`server is running at port : ${PORT}`);
    
  })
})
.catch(error=>{
  console.log("MONGODB CONNECTION FAILED !!",error);
})