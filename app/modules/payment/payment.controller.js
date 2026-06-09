import crypto from "crypto";
import axios from "axios";
import pool from "../../config/pgDB.js";

export const createOrder = async (req, res) => {
    try {
        const {
            product_id,
            actualQuantity = 1,
            payment_type, // advance | full
        } = req.body;

        const user_id = req.user.id;

        if (!product_id) {
            return res.status(400).json({
                success: false,
                message: "Product ID is required",
            });
        }

        if (!payment_type) {
            return res.status(400).json({
                success: false,
                message: "Payment type is required",
            });
        }

        // Product Fetch
        const productResult = await pool.query(
            `SELECT * FROM products WHERE id = $1`,
            [product_id]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        const product = productResult.rows[0];

        // Amount Calculate
        let amount = 0;

        if (payment_type === "advance") {
            amount = Number(product.p_advance_payment);
        } else {
            amount =
                Number(product.p_customer_price) *
                Number(actualQuantity);
        }

        // Unique Transaction Id
        const merchantTransactionId =
            `TXN_${Date.now()}_${user_id}`;

        const merchantUserId =
            `USER_${user_id}`;

        // Save Order Before Payment
        const orderResult = await pool.query(
            `
            INSERT INTO orders (
                user_id,
                product_id,
                quantity,
                amount,
                payment_type,
                transaction_id,
                payment_status,
                order_status
            )
            VALUES (
                $1,$2,$3,$4,$5,$6,'PENDING','PENDING'
            )
            RETURNING *
            `,
            [
                user_id,
                product_id,
                actualQuantity,
                amount,
                payment_type,
                merchantTransactionId,
            ]
        );

        const order = orderResult.rows[0];

        // PhonePe Payload
        const payload = {
            merchantId: process.env.PHONEPE_MERCHANT_ID,
            merchantTransactionId,
            merchantUserId,
            amount: amount * 100, // paisa
            redirectUrl: `${process.env.FRONTEND_URL}/payment-success?transactionId=${merchantTransactionId}`,
            redirectMode: "REDIRECT",
            callbackUrl: `${process.env.API_URL}/payment/phonepe/webhook`,
            paymentInstrument: {
                type: "PAY_PAGE",
            },
        };

        const payloadBase64 = Buffer.from(
            JSON.stringify(payload)
        ).toString("base64");

        const string =
            payloadBase64 +
            "/pg/v1/pay" +
            process.env.PHONEPE_SALT_KEY;

        const sha256 = crypto
            .createHash("sha256")
            .update(string)
            .digest("hex");

        const checksum =
            `${sha256}###${process.env.PHONEPE_SALT_INDEX}`;

        const phonePeResponse = await axios.post(
            "https://api.phonepe.com/apis/hermes/pg/v1/pay",
            {
                request: payloadBase64,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-VERIFY": checksum,
                },
            }
        );

        if (
            !phonePeResponse?.data?.success ||
            !phonePeResponse?.data?.data?.instrumentResponse?.redirectInfo?.url
        ) {
            return res.status(400).json({
                success: false,
                message: "Failed to initiate payment",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Payment initiated successfully",
            order_id: order.order_id,
            transaction_id: merchantTransactionId,
            amount,
            payment_url:
                phonePeResponse.data.data.instrumentResponse.redirectInfo.url,
        });
    } catch (error) {
        console.error("Create Order Error:", error);

        return res.status(500).json({
            success: false,
            message: error?.response?.data?.message || "Internal Server Error",
        });
    }
};

export const checkPaymentStatus = async (req, res) => {
    try {
        const { transactionId } = req.params;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: "Transaction ID is required",
            });
        }

        const merchantId = process.env.PHONEPE_MERCHANT_ID;

        const endpoint =
            `/pg/v1/status/${merchantId}/${transactionId}`;

        const string =
            endpoint + process.env.PHONEPE_SALT_KEY;

        const sha256 = crypto
            .createHash("sha256")
            .update(string)
            .digest("hex");

        const checksum =
            `${sha256}###${process.env.PHONEPE_SALT_INDEX}`;

        const phonePeResponse = await axios.get(
            `https://api.phonepe.com/apis/hermes${endpoint}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-VERIFY": checksum,
                    "X-MERCHANT-ID": merchantId,
                },
            }
        );

        const paymentData = phonePeResponse.data;

        // Order fetch
        const orderResult = await pool.query(
            `
            SELECT *
            FROM orders
            WHERE transaction_id = $1
            `,
            [transactionId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        const order = orderResult.rows[0];

        // Already completed
        if (
            order.payment_status === "COMPLETED"
        ) {
            return res.status(200).json({
                success: true,
                payment_status: "COMPLETED",
                order_id: order.order_id,
                message: "Payment already verified",
            });
        }

        // Payment Success
        if (
            paymentData.success &&
            paymentData.data.state === "COMPLETED"
        ) {

            await pool.query(
                `
                UPDATE orders
                SET
                    payment_status = 'COMPLETED',
                    order_status = 'CONFIRMED',
                    updated_at = NOW()
                WHERE transaction_id = $1
                `,
                [transactionId]
            );

            // Optional:
            // Cart clear karo

            return res.status(200).json({
                success: true,
                payment_status: "COMPLETED",
                order_id: order.order_id,
                data: paymentData.data,
            });
        }

        // Payment Pending
        if (
            paymentData.data.state === "PENDING"
        ) {

            await pool.query(
                `
                UPDATE orders
                SET
                    payment_status = 'PENDING',
                    updated_at = NOW()
                WHERE transaction_id = $1
                `,
                [transactionId]
            );

            return res.status(200).json({
                success: true,
                payment_status: "PENDING",
            });
        }

        // Payment Failed
        await pool.query(
            `
            UPDATE orders
            SET
                payment_status = 'FAILED',
                order_status = 'FAILED',
                updated_at = NOW()
            WHERE transaction_id = $1
            `,
            [transactionId]
        );

        return res.status(200).json({
            success: true,
            payment_status: "FAILED",
            data: paymentData.data,
        });

    } catch (error) {

        console.error(
            "PhonePe Status Error:",
            error?.response?.data || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to verify payment",
        });
    }
}

export const phonePeWebhook = async (req, res) => {
    try {

        console.log("Webhook Received:", req.body);

        const { response } = req.body;

        if (!response) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook payload",
            });
        }

        // Base64 Decode
        const decodedResponse = JSON.parse(
            Buffer.from(response, "base64").toString("utf8")
        );

        const transactionId =
            decodedResponse?.data?.merchantTransactionId;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: "Transaction ID missing",
            });
        }

        // Double Verify from PhonePe
        const merchantId =
            process.env.PHONEPE_MERCHANT_ID;

        const endpoint =
            `/pg/v1/status/${merchantId}/${transactionId}`;

        const string =
            endpoint + process.env.PHONEPE_SALT_KEY;

        const sha256 = crypto
            .createHash("sha256")
            .update(string)
            .digest("hex");

        const checksum =
            `${sha256}###${process.env.PHONEPE_SALT_INDEX}`;

        const statusResponse = await axios.get(
            `https://api.phonepe.com/apis/hermes${endpoint}`,
            {
                headers: {
                    "Content-Type": "application/json",
                    "X-VERIFY": checksum,
                    "X-MERCHANT-ID": merchantId,
                },
            }
        );

        const paymentData = statusResponse.data;

        const orderResult = await pool.query(
            `
            SELECT *
            FROM orders
            WHERE transaction_id = $1
            `,
            [transactionId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        const order = orderResult.rows[0];

        // Already Processed
        if (order.payment_status === "COMPLETED") {
            return res.status(200).json({
                success: true,
                message: "Already processed",
            });
        }

        // Payment Success
        if (
            paymentData.success &&
            paymentData.data.state === "COMPLETED"
        ) {

            await pool.query(
                `
                UPDATE orders
                SET
                    payment_status = 'COMPLETED',
                    order_status = 'CONFIRMED',
                    updated_at = NOW()
                WHERE transaction_id = $1
                `,
                [transactionId]
            );

            // Optional
            // await pool.query(
            //   `DELETE FROM cart WHERE user_id = $1`,
            //   [order.user_id]
            // );

            console.log(
                `Order Confirmed: ${transactionId}`
            );

            return res.status(200).json({
                success: true,
                message: "Payment verified",
            });
        }

        // Payment Failed
        await pool.query(
            `
            UPDATE orders
            SET
                payment_status = 'FAILED',
                order_status = 'FAILED',
                updated_at = NOW()
            WHERE transaction_id = $1
            `,
            [transactionId]
        );

        return res.status(200).json({
            success: true,
            message: "Payment failed",
        });

    } catch (error) {

        console.error(
            "PhonePe Webhook Error:",
            error?.response?.data || error.message
        );

        return res.status(500).json({
            success: false,
            message: "Webhook processing failed",
        });
    }
};