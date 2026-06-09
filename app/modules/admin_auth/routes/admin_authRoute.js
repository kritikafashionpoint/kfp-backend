import express from "express";
import { adminLogin, checkEmailnSendOtp, createNewPassword, resendOtp, verifyOtp, verifyOtpByEmail } from "./admin_auth_controller.js";

const adminAuthRoute = express.Router()

//authentication api's
adminAuthRoute.post('/login', adminLogin)
adminAuthRoute.post('/verify-otp', verifyOtp)
adminAuthRoute.post('/verify-otp-by-email', verifyOtpByEmail)
adminAuthRoute.post('/resend-otp', resendOtp)
adminAuthRoute.post('/send-otp-to-forgot', checkEmailnSendOtp)
adminAuthRoute.post('/create-new-password', createNewPassword)

export default adminAuthRoute