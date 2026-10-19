export const DB_NAME="Nexora"
export const OPTIONS={
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
}
