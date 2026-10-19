export const rollbackOtpAfterEmailFailure = async (
  OTP,
  { otpId, failedHashedOTP, previous },
) => {
  try {
    const result = previous
      ? await OTP.updateOne(
          { _id: otpId, hashedOTP: failedHashedOTP },
          { $set: previous },
        )
      : await OTP.deleteOne({ _id: otpId, hashedOTP: failedHashedOTP });

    if (previous ? result.matchedCount === 0 : result.deletedCount === 0) {
      console.warn("OTP email-failure rollback skipped because the OTP changed");
    }
  } catch (error) {
    console.error("OTP email-failure rollback failed", {
      name: error?.name || "UnknownError",
    });
  }
};
