import jwt from "jsonwebtoken"
import bcrypt from 'bcrypt'
import pool from "../../../config/pgDB.js"
import { sendOtpMail } from "../../../config/nodemailer.js"
import { changePasswordService, checkEmailAndPasswordService, checkEmailExistsService, sendOtpService } from "../admin_auth.service.js"


//Authentication Api's
export const adminLogin = async (req, res) => {
    try {

        const { admin_email, admin_password } = req.body
        // console.log(req.body)

        const admin = await checkEmailAndPasswordService(admin_email, admin_password)

        if (!admin) {
            return res.json({
                success: false,
                msg: "Admin Email and Password are wrong"
            })
        }

        // send OTP
        await sendOtpService(admin)

        res.status(200).json({
            success: true,
            msg: "OTP sent to your email",
            admin_id: admin.id
        })

    } catch (error) {
        console.log(error.message || "Server Error")
        return res.status(500).json({
            success: false,
            msg: 'Something Went Wrong'
        })
    }
}

export const verifyOtp = async (req, res) => {
    try {

        const { admin_id, otp } = req.body

        const result = await pool.query(
            `SELECT * FROM admin_user WHERE id=$1`,
            [admin_id]
        )

        const admin = result.rows[0]

        if (!admin) {
            return res.status(404).json({
                success: false,
                msg: "Admin not found"
            })
        }

        if (admin.otp != otp) {
            return res.status(401).json({
                success: false,
                msg: "Invalid OTP"
            })
        }

        if (Date.now() > admin.otp_expire) {
            return res.status(410).json({
                success: false,
                msg: "OTP expired"
            })
        }

        const token = jwt.sign(
            {
                id: admin.id,
                email: admin.admin_email
            },
            process.env.JWT_SECRET
        )

        return res.status(200).json({
            success: true,
            msg: "OTP verified",
            token
        })

    } catch (error) {

        console.log(error)

        return res.status(500).json({
            success: false,
            msg: "Internal Server Error"
        })
    }
}

export const resendOtp = async (req, res) => {
    try {

        const { admin_id } = req.body

        if (!admin_id) {
            return res.status(400).json({
                success: false,
                msg: "Admin id is required"
            })
        }

        const result = await pool.query(
            `SELECT * FROM admin_user WHERE id=$1`,
            [admin_id]
        )

        const admin = result.rows[0]

        if (!admin) {
            return res.status(404).json({
                success: false,
                msg: "Admin not found"
            })
        }

        // generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000)

        const otp_expire = new Date(Date.now() + 5 * 60 * 1000);

        await pool.query(
            `UPDATE admin_user SET otp=$1 , otp_expire=$2 WHERE id=$3`,
            [otp, otp_expire, admin_id]
        )

        // send email
        await sendOtpMail(admin.admin_email, otp)

        return res.status(200).json({
            success: true,
            msg: "OTP sent successfully"
        })

    } catch (error) {

        console.log(error)

        return res.status(500).json({
            success: false,
            msg: "Internal Server Error"
        })
    }
}

export const checkEmailnSendOtp = async (req, res) => {
    try {
        const { admin_email } = req.body

        const admin = await checkEmailExistsService(admin_email)

        if (!admin) {
            return res.status(404).json({
                success: false,
                msg: 'You Entered a wrong Email !'
            })
        }

        // generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000)
        const otp_expire = Date.now() + 5 * 60 * 1000 // 5 minutes

        await pool.query(
            `UPDATE admin_user 
             SET otp=$1 , otp_expire=$2 
             WHERE admin_email=$3`,
            [otp, otp_expire, admin_email]
        )

        await sendOtpMail(admin.admin_email, otp)

        return res.status(200).json({
            success: true,
            msg: 'OTP Sent Successfully'
        })

    } catch (error) {

        console.log(error.message || 'Server Error')

        return res.status(500).json({
            success: false,
            msg: 'Server Error'
        })
    }
}

export const verifyOtpByEmail = async (req, res) => {
    try {

        const { admin_email, otp } = req.body

        const result = await pool.query(
            `SELECT * FROM admin_user WHERE admin_email = $1`,
            [admin_email]
        )

        const admin = result.rows[0]

        if (!admin) {
            return res.status(404).json({
                success: false,
                msg: "Admin not found"
            })
        }

        if (admin.otp != otp) {
            return res.status(401).json({
                success: false,
                msg: "Invalid OTP"
            })
        }

        if (Date.now() > admin.otp_expire) {
            return res.status(410).json({
                success: false,
                msg: "OTP expired"
            })
        }

        return res.status(200).json({
            success: true,
            msg: "OTP verified",
        })

    } catch (error) {

        console.log(error)

        return res.status(500).json({
            success: false,
            msg: "Internal Server Error"
        })
    }
}

export const createNewPassword = async (req, res) => {
    try {
        const { new_password, admin_email } = req.body
        const hashedPassword = await bcrypt.hash(new_password, 10)
        const response = await changePasswordService(hashedPassword, admin_email)
        if (!response) {
            return res.status(404).json({
                success: false,
                msg: 'Cannot change password'
            })
        }
        else {
            return res.status(200).json({
                success: true,
                msg: 'Password Changed Successfully !'
            })
        }

    } catch (error) {
        console.log(error.message || 'Server Error')
        return res.status(500).json({
            success: false,
            msg: 'Server Error',
            error
        })
    }
}

//Categories Api's
