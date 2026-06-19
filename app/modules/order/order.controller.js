import pool from "../../config/pgDB.js";
import razorpay from "../razorpay/razorpay.js";
import crypto from 'crypto'
import { sendOrderBookedMail } from "../../config/nodemailer.js";

export const createOrder = async (req, res) => {
    console.log(process.env.RAZORPAY_KEY_ID);
    console.log(process.env.RAZORPAY_KEY_SECRET);
    console.log(process.env.RAZORPAY_KEY_SECRET.length)
    try {


        const {
            product_id,
            payment_type,
            payment_status = "pending",
            order_status = "pending"
        } = req.body;

        const user_id = req.user.id;

        if (!product_id) {
            return res.status(400).json({
                success: false,
                msg: "Product ID is required"
            });
        }

        const productResult = await pool.query(
            `
            SELECT
                id,
                p_advance_payment,
                p_customer_price
            FROM products
            WHERE id = $1
            `,
            [product_id]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                msg: "Product not found"
            });
        }

        const product = productResult.rows[0];

        const amount =
            payment_type === "advance"
                ? Number(product.p_advance_payment)
                : Number(product.p_customer_price);

        const order_uuid = crypto.randomUUID();

        // Razorpay Order Create
        const razorpayOrder = await razorpay.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: order_uuid
        });

        await pool.query("BEGIN");

        const orderResult = await pool.query(
            `
            INSERT INTO orders
            (
                uuid,
                user_id,
                total_amount,
                payment_type,
                payment_status,
                order_status,
                razorpay_order_id
            )
            VALUES
            (
                $1,$2,$3,$4,$5,$6,$7
            )
            RETURNING id
            `,
            [
                order_uuid,
                user_id,
                amount,
                payment_type,
                payment_status,
                order_status,
                razorpayOrder.id
            ]
        );

        const order_id = orderResult.rows[0].id;

        await pool.query(
            `
            INSERT INTO order_items
            (
                order_id,
                product_id,
                quantity,
                price
            )
            VALUES
            (
                $1,$2,$3,$4
            )
            `,
            [
                order_id,
                product_id,
                1,
                amount
            ]
        );

        await pool.query("COMMIT");

        return res.status(201).json({
            success: true,

            order_id,
            order_uuid,

            razorpay_order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,

            key: process.env.RAZORPAY_KEY_ID,

            msg: "Order created successfully"
        });

    } catch (error) {

        await pool.query("ROLLBACK");

        console.error(error);

        return res.status(500).json({
            success: false,
            msg: "Internal server error"
        });
    }
};

export const verifyPayment = async (req, res) => {
    try {

        const {
            order_id,
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (
            !order_id ||
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature
        ) {
            return res.status(400).json({
                success: false,
                msg: "Missing payment details"
            });
        }

        const body =
            razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(body)
            .digest("hex");

        const isAuthentic =
            expectedSignature === razorpay_signature;

        if (!isAuthentic) {

            await pool.query(
                `
                UPDATE orders
                SET payment_status = 'failed'
                WHERE id = $1
                `,
                [order_id]
            );

            return res.status(400).json({
                success: false,
                msg: "Payment verification failed"
            });
        }

        // Update Order
        await pool.query(
            `
            UPDATE orders
            SET
                payment_status = 'paid',
                order_status = 'confirmed',
                razorpay_payment_id = $1,
                razorpay_signature = $2
            WHERE id = $3
            `,
            [
                razorpay_payment_id,
                razorpay_signature,
                order_id
            ]
        );

        // Fetch Order Details
        const orderResult = await pool.query(
            `
            SELECT
                id,
                user_id,
                total_amount,
                payment_type
            FROM orders
            WHERE id = $1
            `,
            [order_id]
        );

        const order = orderResult.rows[0];

        // Fetch User Details
        const userResult = await pool.query(
            `
            SELECT
                name,
                email
            FROM web_user
            WHERE user_id = $1
            `,
            [order.user_id]
        );

        const user = userResult.rows[0];

        console.log("Before mail");


        // Send Confirmation Mail
        if (user?.email) {

            await sendOrderBookedMail(
                user.email,
                user.name || "Customer",
                order.id,
                razorpay_payment_id,
                order.total_amount,
                order.payment_type
            );
        }

        console.log("After mail");

        return res.status(200).json({
            success: true,
            msg: "Payment verified successfully"
        });

    } catch (error) {

        console.error("VERIFY PAYMENT ERROR:", error);

        return res.status(500).json({
            success: false,
            msg: "Internal server error"
        });
    }
};

export const viewAllOrders = async (req, res) => {

    try {

        const query = `
                    SELECT
                o.id,
                o.uuid,
                o.total_amount,
                o.payment_type,
                o.payment_status,
                o.order_status,
                o.created_at,

                w.user_id,
                w.name,
                w.email,
                w.mobile,

                oi.id AS order_item_id,
                oi.quantity,
                oi.price,

                p.id AS product_id,
                p.p_title,
                p.p_slug,
                p.p_short_description,
                p.p_full_description,
                p.p_discount,
                p.p_advance_payment,
                p.p_type,
                p.is_top_selling,
                p.p_quantity,
                p.p_sale_price,
                p.p_customer_price,
                p.p_material,
                p.p_finishing,
                p.p_occasion,
                p.p_include_items,
                p.p_meta_title,
                p.p_meta_description,
                p.category_id,

                pi.index_image,
                pi.gallery_images,

                c.category_name,
                c.category_slug

            FROM orders o

            INNER JOIN web_user w
                ON o.user_id = w.user_id

            LEFT JOIN order_items oi
                ON o.id = oi.order_id

            LEFT JOIN products p
                ON oi.product_id = p.id

            LEFT JOIN product_images pi
                ON p.id = pi.product_id

            LEFT JOIN categories c
                ON p.category_id = c.category_id

            ORDER BY o.id ASC`

        const result = await pool.query(query);

        // Group orders
        const ordersMap = {};

        result.rows.forEach(row => {

            if (!ordersMap[row.id]) {
                ordersMap[row.id] = {
                    order_id: row.id,
                    order_uuid: row.uuid,
                    total_amount: row.total_amount,
                    payment_type: row.payment_type,
                    payment_status: row.payment_status,
                    order_status: row.order_status,
                    created_at: row.created_at,

                    customer: {
                        user_id: row.user_id,
                        name: row.name,
                        email: row.email,
                        mobile: row.mobile,
                    },

                    items: []
                };
            }

            if (row.product_id) {
                ordersMap[row.id].items.push({
                    order_item_id: row.order_item_id,
                    product_id: row.product_id,
                    product_title: row.p_title,
                    product_slug: row.p_slug,
                    product_image: row.index_image,
                    quantity: row.quantity,
                    price: row.price
                });
            }
        });

        return res.status(200).json({
            success: true,
            count: Object.keys(ordersMap).length,
            data: Object.values(ordersMap)
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};