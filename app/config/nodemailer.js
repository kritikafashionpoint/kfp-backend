import nodemailer from "nodemailer"
export const sendOtpMail = async (email, otp) => {
    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS } })

    await transporter.sendMail({ from: process.env.MAIL_USER, to: email, subject: "Admin Login OTP For KRITIKA FASHION POINT", html: ` <div style=" background:#050505; padding:50px 0; font-family:Arial, Helvetica, sans-serif; "> <div style=" max-width:520px; margin:auto; background:linear-gradient(145deg,#0b0b0b,#161616); border:1px solid #c9a227; border-radius:18px; overflow:hidden; box-shadow:0 0 35px rgba(201,162,39,0.25); "> <div style=" height:6px; background:linear-gradient(to right,#8f6b10,#f5d36b,#8f6b10); "></div> <div style="padding:45px 35px;text-align:center"> <h1 style=" color:#f5d36b; margin:0; font-size:32px; letter-spacing:2px; font-weight:bold; "> KRITIKA FASHION POINT </h1> <p style=" color:#b8b8b8; margin-top:10px; font-size:14px; letter-spacing:1px; "> Premium Secure Admin Verification </p> <div style=" width:80px; height:2px; background:#c9a227; margin:30px auto; "></div> <h2 style=" color:white; font-size:26px; margin-bottom:12px; "> Your Login OTP </h2> <p style=" color:#cfcfcf; font-size:15px; line-height:24px; margin-bottom:30px; "> Use this One Time Password to securely access your <b style="color:#f5d36b">Admin Dashboard</b>. </p> <div style=" background:#0a0a0a; border:2px solid #c9a227; border-radius:14px; padding:22px; margin-bottom:30px; box-shadow:inset 0 0 15px rgba(201,162,39,0.15); "> <span style=" color:#f5d36b; font-size:38px; font-weight:bold; letter-spacing:10px; "> ${otp} </span> </div> <p style=" color:#b8b8b8; font-size:14px; margin-bottom:25px; "> OTP expires in <span style="color:#f5d36b;font-weight:bold"> 5 minutes </span> </p> <div style=" background:#111; border-left:3px solid #c9a227; padding:14px; border-radius:8px; text-align:left; margin-bottom:30px; "> <p style=" margin:0; color:#d0d0d0; font-size:13px; line-height:22px; "> If you did not request this login, please ignore this email or contact the administrator immediately. </p> </div> <p style=" color:#7f7f7f; font-size:12px; line-height:22px; margin:0; "> © ${new Date().getFullYear()} KRITIKA FASHION POINT <br> Premium Secure Administration System </p> </div> </div> </div> ` })
}


export const sendOtpMailForWebUser = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
    });

    await transporter.sendMail({
        from: `"Kritika Fashion Point" <${process.env.MAIL_USER}>`,
        to: email,
        subject: "Your Verification Code",
        html: `
        <div style="
            max-width:600px;
            margin:0 auto;
            padding:40px 20px;
            font-family:Arial,Helvetica,sans-serif;
            color:#333333;
            background:#ffffff;
        ">

            <h2 style="
                margin-bottom:20px;
                color:#111111;
            ">
                Verify Your Account
            </h2>

            <p style="
                font-size:15px;
                line-height:24px;
            ">
                Hello,
            </p>

            <p style="
                font-size:15px;
                line-height:24px;
            ">
                We received a request to verify your account on
                <strong>Kritika Fashion Point</strong>.
            </p>

            <p style="
                font-size:15px;
                line-height:24px;
            ">
                Use the verification code below:
            </p>

            <div style="
                text-align:center;
                margin:30px 0;
            ">
                <div style="
                    display:inline-block;
                    padding:15px 30px;
                    border:1px solid #d4af37;
                    border-radius:8px;
                    background:#fafafa;
                    font-size:32px;
                    font-weight:bold;
                    letter-spacing:8px;
                    color:#111111;
                ">
                    ${otp}
                </div>
            </div>

            <p style="
                font-size:14px;
                line-height:24px;
            ">
                This code will expire in <strong>5 minutes</strong>.
            </p>

            <p style="
                font-size:14px;
                line-height:24px;
            ">
                If you did not request this code, you can safely ignore this email.
            </p>

            <hr style="
                border:none;
                border-top:1px solid #e5e5e5;
                margin:30px 0;
            ">

            <p style="
                font-size:12px;
                color:#666666;
                line-height:20px;
            ">
                For security reasons, never share this verification code with anyone.
            </p>

            <p style="
                font-size:12px;
                color:#666666;
                margin-top:20px;
            ">
                © ${new Date().getFullYear()} Kritika Fashion Point
            </p>

        </div>
        `,
        text: `
Verify Your Account

Your verification code is: ${otp}

This code will expire in 5 minutes.

If you did not request this code, please ignore this email.

Kritika Fashion Point
        `,
    });
};

export const sendOrderBookedMail = async (
    email,
    customerName,
    orderId,
    paymentId,
    amount,
    paymentType
) => {

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASS,
        },
    });

    await transporter.sendMail({
        from: `"Kritika Fashion Point Orders" <${process.env.MAIL_USER}>`,
        to: email,

        subject: `Order Confirmation #${orderId}`,

        html: `
        <div style="
            max-width:600px;
            margin:0 auto;
            padding:32px 20px;
            font-family:Arial,Helvetica,sans-serif;
            background:#ffffff;
            color:#222222;
        ">

            <h2 style="
                margin:0 0 24px 0;
                color:#111111;
                font-size:24px;
            ">
                Order Confirmation
            </h2>

            <p style="
                font-size:15px;
                line-height:24px;
                margin-bottom:20px;
            ">
                Hello ${customerName},
            </p>

            <p style="
                font-size:15px;
                line-height:24px;
            ">
                We have successfully received your payment and your order has been confirmed.
            </p>

            <table style="
                width:100%;
                border-collapse:collapse;
                margin:25px 0;
                border:1px solid #e5e5e5;
            ">
                <tr>
                    <td style="padding:12px;border-bottom:1px solid #e5e5e5;">
                        Order ID
                    </td>
                    <td style="padding:12px;border-bottom:1px solid #e5e5e5;">
                        ${orderId}
                    </td>
                </tr>

                <tr>
                    <td style="padding:12px;border-bottom:1px solid #e5e5e5;">
                        Payment ID
                    </td>
                    <td style="padding:12px;border-bottom:1px solid #e5e5e5;">
                        ${paymentId}
                    </td>
                </tr>

                <tr>
                    <td style="padding:12px;border-bottom:1px solid #e5e5e5;">
                        Amount Paid
                    </td>
                    <td style="padding:12px;border-bottom:1px solid #e5e5e5;">
                        ₹${amount}
                    </td>
                </tr>

                <tr>
                    <td style="padding:12px;">
                        Payment Type
                    </td>
                    <td style="padding:12px;">
                        ${paymentType === "advance"
                ? "Advance Payment"
                : "Full Payment"}
                    </td>
                </tr>
            </table>

            <p style="
                font-size:14px;
                line-height:24px;
            ">
                Your order is now being processed.
            </p>

            <hr style="
                border:none;
                border-top:1px solid #e5e5e5;
                margin:30px 0;
            ">

            <p style="
                font-size:12px;
                color:#666666;
                line-height:20px;
            ">
                This is an automated transactional email regarding your order.
            </p>

            <p style="
                font-size:12px;
                color:#666666;
                line-height:20px;
            ">
                Kritika Fashion Point
            </p>

        </div>
        `,

        text: `
Order Confirmation

Hello ${customerName},

Your payment has been received and your order has been confirmed.

Order ID: ${orderId}
Payment ID: ${paymentId}
Amount Paid: ₹${amount}
Payment Type: ${paymentType}

This is an automated transactional email.

Kritika Fashion Point
        `
    });
};