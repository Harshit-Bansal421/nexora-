class ApiResponse{
  constructor(
    statuscode,
    data=[],
    message="success"
  ){
    this.data=data
    this.statuscode=statuscode,
    this.message=message
    this.status=statuscode<500
  }
}

export default ApiResponse