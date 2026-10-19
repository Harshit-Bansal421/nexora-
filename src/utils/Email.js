import { Resend } from "resend";
import ApiError from "./ApiError.js";

const logResendFailure = (error) => {
  const details = {
    name:
      typeof error?.name === "string" && /^[a-z\d_-]+$/i.test(error.name)
        ? error.name
        : "UnknownError",
    statusCode: Number.isInteger(error?.statusCode)
      ? error.statusCode
      : undefined,
  };

  console.error("Resend email request failed", details);
};

export const sendEmail = async ({ to, subject = "verify", html }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.error("Resend email delivery is not configured", {
      missingApiKey: !apiKey,
      missingSender: !from,
    });
    throw new ApiError(503, "Email delivery is temporarily unavailable");
  }

  let result;
  try {
    const resend = new Resend(apiKey);
    result = await resend.emails.send({ from, to, subject, html });
  } catch (error) {
    logResendFailure(error);
    throw new ApiError(503, "Email delivery is temporarily unavailable");
  }

  if (result?.error || !result?.data?.id) {
    logResendFailure(result?.error);
    throw new ApiError(503, "Email delivery is temporarily unavailable");
  }

  return result.data;
};
