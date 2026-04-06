export const asyncHandler=(func)=>{
  return (req,res,next)=>{
    Promise.resolve(func(req,res,next)).catch(error=> next(error))//next(error)-Express error middleware handles it
  }
}