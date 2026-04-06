export const getVerificationEmailHTML = (username, otp) => {
  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:10px;overflow:hidden;">
      
      <div style="background:#111;color:#fff;padding:20px;text-align:center;">
        <h2 style="margin:0;">Nexora</h2>
      </div>

      <div style="padding:30px;text-align:center;">
        <h3 style="margin-bottom:10px;">Verify Your Account</h3>
        <p style="color:#555;">Hi <b>${username}</b>,</p>
        <p style="color:#555;">
          Use the OTP below to verify your account. This code is valid for 10 minutes.
        </p>

        <div style="margin:30px 0;">
          <span style="
            font-size:32px;
            letter-spacing:5px;
            background:#f1f1f1;
            padding:15px 25px;
            border-radius:8px;
            display:inline-block;
          ">
            ${otp}
          </span>
        </div>

        <p style="color:#888;font-size:14px;">
          This OTP will expire in 10 minutes.
        </p>

        <p style="color:#888;font-size:14px;">
          If you didn’t request this, you can safely ignore this email.
        </p>
      </div>

      <div style="background:#f9f9f9;padding:15px;text-align:center;font-size:12px;color:#aaa;">
        © Nexora — All rights reserved
      </div>

    </div>
  </body>
  </html>
  `;
};

export const getPasswordResetEmailHTML = (username, otp) => {
  return `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:10px;overflow:hidden;">
      
      <div style="background:#d32f2f;color:#fff;padding:20px;text-align:center;">
        <h2 style="margin:0;">Password Reset</h2>
      </div>

      <div style="padding:30px;text-align:center;">
        <h3 style="margin-bottom:10px;">Reset Your Password</h3>
        <p style="color:#555;">Hi <b>${username}</b>,</p>
        <p style="color:#555;">
          We received a request to reset your password. Use the OTP below to proceed.
        </p>

        <div style="margin:30px 0;">
          <span style="
            font-size:32px;
            letter-spacing:5px;
            background:#fff3f3;
            color:#d32f2f;
            padding:15px 25px;
            border-radius:8px;
            display:inline-block;
          ">
            ${otp}
          </span>
        </div>

        <p style="color:#888;font-size:14px;">
          This OTP will expire in 10 minutes.
        </p>

        <p style="color:#888;font-size:14px;">
          If you didn’t request a password reset, ignore this email.
        </p>
      </div>

      <div style="background:#f9f9f9;padding:15px;text-align:center;font-size:12px;color:#aaa;">
        © Nexora — Secure Auth System
      </div>

    </div>
  </body>
  </html>
  `;
};
