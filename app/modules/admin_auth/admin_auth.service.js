
//Authentication Services
export const checkEmailAndPasswordService = async (admin_email, admin_password) => {
    try {

        // 1️⃣ get admin by email
        const result = await pool.query(
            `SELECT * FROM admin_user WHERE admin_email = $1`,
            [admin_email]
        );

        const admin = result.rows[0];

        if (!admin) {
            return null;
        }

        // 2️⃣ compare password
        const isMatch = await bcrypt.compare(admin_password, admin.admin_password);

        if (!isMatch) {
            return null;
        }

        return admin;

    } catch (error) {
        console.log(error);
        return null;
    }
};

export const sendOtpService = async (admin) => {
    try {
        const otp = Math.floor(100000 + Math.random() * 900000)
        const expiry = Date.now() + 5 * 60 * 1000

        await pool.query(
            `UPDATE admin_user SET otp=$1 , otp_expire=$2 where id=$3`,
            [otp, expiry, admin.id]
        )

        // console.log("OTP:", otp)

        const mailRes = await sendOtpMail(admin.admin_email, otp)

        console.log("MAIL RESPONSE:", mailRes)

        return mailRes

    } catch (error) {
        console.log("OTP SERVICE ERROR ❌:", error)
        throw error   // 🔥 VERY IMPORTANT
    }
}

export const checkEmailExistsService = async (admin_email) => {
    try {
        const response = await pool.query(`
            SELECT * FROM admin_user
            WHERE admin_email = $1
            `, [admin_email])

        const result = await response.rows[0]
        return result;
    } catch (error) {
        console.log(error)
    }
}

export const changePasswordService = async (hashedPassword, admin_email) => {
    try {
        const result = await pool.query(
            `
                UPDATE admin_user
                SET
                admin_password = $1
                WHERE admin_email = $2
                RETURNING *
            `, [hashedPassword, admin_email])

        // console.log(result)
        const finalRes = result.rows[0]

        return finalRes;
    } catch (error) {
        console.log(error)
    }
}