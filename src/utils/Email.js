// import { Resend } from "resend";

// const resend = new Resend(process.env.RESEND_APIKEY);

// const sendEmail = async ({sender="onboarding@resend.dev",receipt="bansalharshit341@gmail.com",subject="verify email",html}) => {
//   return resend.emails.send({
//     from: sender,
//     to: receipt,
//     subject: subject,
//     html: html,
//   });
// };

// export {sendEmail}

//using nodemailer because of domain issue in resend

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.NODEMAILER_GMAIL,
    pass: process.env.NODEMAILER_PASSKEY, // NOT real password
  },
});

export const sendEmail = async ({to, subject="verify", html}) => {
  try {
    return await transporter.sendMail({
      from: `"Nexora" <${process.env.NODEMAILER_GMAIL}>`,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error("Email error:", error);
  }
};