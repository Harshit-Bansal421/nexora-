import test from "node:test";
import assert from "node:assert/strict";
import { rollbackOtpAfterEmailFailure } from "../src/utils/rollbackOtpAfterEmailFailure.js";

test("failed signup email deletes only the OTP created for that message", async () => {
  let call;
  const OTP = {
    deleteOne: async (...args) => {
      call = args;
      return { deletedCount: 1 };
    },
  };
  await rollbackOtpAfterEmailFailure(OTP, {
    otpId: "otp-1",
    failedHashedOTP: "hash-1",
  });
  assert.deepEqual(call, [{ _id: "otp-1", hashedOTP: "hash-1" }]);
});

test("failed resend restores prior OTP state only if the failed OTP is still current", async () => {
  let call;
  const previous = { hashedOTP: "old-hash", resendCount: 2 };
  const OTP = {
    updateOne: async (...args) => {
      call = args;
      return { matchedCount: 1 };
    },
  };
  await rollbackOtpAfterEmailFailure(OTP, {
    otpId: "otp-2",
    failedHashedOTP: "new-hash",
    previous,
  });
  assert.deepEqual(call, [
    { _id: "otp-2", hashedOTP: "new-hash" },
    { $set: previous },
  ]);
});

test("rollback failures do not expose provider details or replace the mail error", async () => {
  const originalError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    await rollbackOtpAfterEmailFailure(
      { deleteOne: async () => { throw new Error("sensitive provider text"); } },
      { otpId: "otp-3", failedHashedOTP: "hash-3" },
    );
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(logged, [["OTP email-failure rollback failed", { name: "Error" }]]);
});
