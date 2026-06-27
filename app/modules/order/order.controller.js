import pool from "../../config/pgDB.js";
import razorpay from "../razorpay/razorpay.js";
import crypto from 'crypto'
import { sendOrderBookedMail } from "../../config/nodemailer.js";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "replacement_requests",
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        streamifier.createReadStream(buffer).pipe(stream);
    });
};

export const createOrder = async (req, res) => {
    console.log(process.env.RAZORPAY_KEY_ID);
    console.log(process.env.RAZORPAY_KEY_SECRET);
    console.log(process.env.RAZORPAY_KEY_SECRET.length)

    try {
        const {
            product_id,
            payment_type,
            payment_status = "pending",
            order_status = "pending",
            total_quantity
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
                ? Number(product.p_advance_payment * total_quantity)
                : Number(product.p_customer_price * total_quantity);

        const order_uuid = crypto.randomUUID();

        // Razorpay Order Create
        const razorpayOrder = await razorpay.orders.create({
            amount: amount * 100,
            currency: "INR",
            receipt: order_uuid
        });

        console.log("PRODUCT", product);
        console.log("QUANTITY", total_quantity);
        console.log("AMOUNT", amount);

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
                total_quantity,
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

        console.log("isAuthentic", isAuthentic);

        console.log("Expected", expectedSignature);

        console.log("Received", razorpay_signature);

        console.log("Order ID", order_id);

        console.log("Razorpay Order", razorpay_order_id);

        console.log("Payment", razorpay_payment_id);

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

        await pool.query(
            `
            UPDATE products p
            SET p_quantity = GREATEST(
                p.p_quantity - oi.quantity,
                0
            )
            FROM order_items oi
            WHERE oi.product_id = p.id
            AND oi.order_id = $1
            `,
            [order_id]
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
                name
            FROM web_user
            WHERE user_id = $1
            `,
            [order.user_id]
        );

        const user = userResult.rows[0];


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
            o.id AS order_id,
            o.uuid,
            o.total_amount,
            o.payment_type,
            o.payment_status,
            o.order_status,
            o.created_at AS order_created_at,

            w.user_id,
            w.name AS customer_name,
            w.mobile AS customer_mobile,

            ua.id AS address_id,
            ua.name AS address_name,
            ua.mobile AS address_mobile,
            ua.city AS address_city,
            ua.pincode AS address_pincode,
            ua.address AS address_text,
            ua.created_at AS address_created_at,
            ua.updated_at AS address_updated_at,

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

        LEFT JOIN user_addresses ua
            ON o.user_id = ua.user_id

        LEFT JOIN order_items oi
            ON o.id = oi.order_id

        LEFT JOIN products p
            ON oi.product_id = p.id

        LEFT JOIN product_images pi
            ON p.id = pi.product_id

        LEFT JOIN categories c
            ON p.category_id = c.category_id

        WHERE o.order_status != 'pending'

        ORDER BY o.created_at DESC
    `;

        const result = await pool.query(query);

        const ordersMap = {};

        result.rows.forEach((row) => {

            if (!ordersMap[row.order_id]) {

                ordersMap[row.order_id] = {
                    order_id: row.order_id,
                    order_uuid: row.uuid,
                    total_amount: row.total_amount,
                    payment_type: row.payment_type,
                    payment_status: row.payment_status,
                    order_status: row.order_status,
                    created_at: row.order_created_at,

                    customer: {
                        user_id: row.user_id,
                        name: row.customer_name,
                        mobile: row.customer_mobile,
                    },

                    address: row.address_id
                        ? {
                            id: row.address_id,
                            name: row.address_name,
                            mobile: row.address_mobile,
                            city: row.address_city,
                            pincode: row.address_pincode,
                            address: row.address_text,
                            created_at: row.address_created_at,
                            updated_at: row.address_updated_at,
                        }
                        : null,

                    items: []
                };
            }

            if (row.product_id) {

                ordersMap[row.order_id].items.push({
                    order_item_id: row.order_item_id,
                    product_id: row.product_id,
                    product_title: row.p_title,
                    product_slug: row.p_slug,
                    product_image: row.index_image,
                    quantity: row.quantity,
                    price: row.price,

                    product_details: {
                        short_description: row.p_short_description,
                        full_description: row.p_full_description,
                        discount: row.p_discount,
                        advance_payment: row.p_advance_payment,
                        type: row.p_type,
                        is_top_selling: row.is_top_selling,
                        quantity_available: row.p_quantity,
                        sale_price: row.p_sale_price,
                        customer_price: row.p_customer_price,
                        material: row.p_material,
                        finishing: row.p_finishing,
                        occasion: row.p_occasion,
                        include_items: row.p_include_items,
                        meta_title: row.p_meta_title,
                        meta_description: row.p_meta_description,
                    },

                    category: {
                        id: row.category_id,
                        name: row.category_name,
                        slug: row.category_slug,
                    },

                    images: {
                        index_image: row.index_image,
                        gallery_images: row.gallery_images,
                    }
                });
            }
        });

        console.log(Object.values(ordersMap))

        return res.status(200).json({
            success: true,
            count: Object.keys(ordersMap).length,
            data: Object.values(ordersMap),
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

export const viewOrderByUserId = async (req, res) => {
    try {

        const user_id = req.user.id;

        const query = `
            SELECT
                o.id AS order_id,
                o.uuid AS order_uuid,
                o.total_amount,
                o.payment_type,
                o.payment_status,
                o.order_status,
                o.created_at,

                oi.id AS order_item_id,
                oi.quantity,
                oi.price AS item_price,

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

                c.category_id,
                c.category_name,
                c.category_slug,

                pi.index_image,
                pi.gallery_images

            FROM orders o

            LEFT JOIN order_items oi
                ON oi.order_id = o.id

            LEFT JOIN products p
                ON p.id = oi.product_id

            LEFT JOIN product_images pi
                ON pi.product_id = p.id

            LEFT JOIN categories c
                ON c.category_id = p.category_id

            WHERE o.user_id = $1
            AND o.payment_status = 'paid'

            ORDER BY o.created_at DESC
        `;

        const result = await pool.query(query, [user_id]);

        const ordersMap = {};

        result.rows.forEach((row) => {

            if (!ordersMap[row.order_id]) {

                ordersMap[row.order_id] = {
                    order_id: row.order_id,
                    order_uuid: row.order_uuid,
                    total_amount: row.total_amount,
                    payment_type: row.payment_type,
                    payment_status: row.payment_status,
                    order_status: row.order_status,
                    created_at: row.created_at,
                    items: []
                };
            }

            if (row.product_id) {

                ordersMap[row.order_id].items.push({
                    order_item_id: row.order_item_id,
                    quantity: row.quantity,
                    ordered_price: row.item_price,

                    product: {
                        id: row.product_id,
                        title: row.p_title,
                        slug: row.p_slug,
                        short_description: row.p_short_description,
                        full_description: row.p_full_description,

                        discount: row.p_discount,
                        advance_payment: row.p_advance_payment,

                        type: row.p_type,
                        is_top_selling: row.is_top_selling,
                        stock: row.p_quantity,

                        sale_price: row.p_sale_price,
                        customer_price: row.p_customer_price,

                        material: row.p_material,
                        finishing: row.p_finishing,
                        occasion: row.p_occasion,
                        include_items: row.p_include_items,

                        meta_title: row.p_meta_title,
                        meta_description: row.p_meta_description,

                        image: row.index_image,
                        gallery_images: row.gallery_images,

                        category: {
                            id: row.category_id,
                            name: row.category_name,
                            slug: row.category_slug
                        }
                    }
                });
            }
        });

        return res.status(200).json({
            success: true,
            count: Object.keys(ordersMap).length,
            data: Object.values(ordersMap)
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const outForDelivery = async (req, res) => {
    try {
        const { order_id } = req.body;

        const response = await pool.query(
            `
            UPDATE orders
            SET order_status = 'out_for_delivery'
            WHERE id = $1
            RETURNING *;
            `,
            [order_id]
        );

        if (response.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Order marked as out for delivery",
            order: response.rows[0],
        });
    } catch (error) {
        console.error("Out For Delivery Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const saveUserAddress = async (req, res) => {
    try {
        const user_id = req.user.id; // auth middleware se

        const {
            name,
            mobile,
            city,
            pincode,
            address
        } = req.body;

        const existingAddress = await pool.query(
            `SELECT id FROM user_addresses WHERE user_id = $1`,
            [user_id]
        );

        if (existingAddress.rows.length > 0) {
            // Update
            await pool.query(
                `
                UPDATE user_addresses
                SET
                    name = $1,
                    mobile = $2,
                    city = $3,
                    pincode = $4,
                    address = $5,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $6
                `,
                [
                    name,
                    mobile,
                    city,
                    pincode,
                    address,
                    user_id
                ]
            );

            return res.status(200).json({
                success: true,
                message: "Address updated successfully"
            });
        }

        // Insert
        await pool.query(
            `
            INSERT INTO user_addresses
            (
                user_id,
                name,
                mobile,
                city,
                pincode,
                address
            )
            VALUES ($1,$2,$3,$4,$5,$6)
            `,
            [
                user_id,
                name,
                mobile,
                city,
                pincode,
                address
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Address saved successfully"
        });

    } catch (error) {
        console.error("Save Address Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

export const getUserAddressById = async (req, res) => {
    try {
        const user_id = req.user.id;

        const response = await pool.query(
            `
            SELECT
                id,
                user_id,
                name,
                mobile,
                city,
                pincode,
                address,
                created_at,
                updated_at
            FROM user_addresses
            WHERE user_id = $1
            LIMIT 1
            `,
            [user_id]
        );

        if (response.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Address not found",
            });
        }

        return res.status(200).json({
            success: true,
            data: response.rows[0],
        });

    } catch (error) {
        console.error("Get Address Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

export const checkUserAddExists = async (req, res) => {
    const user_id = req.user.id;
    console.log("USER ID:", user_id);

    try {



        const result = await pool.query(
            `
            SELECT id
            FROM user_addresses
            WHERE user_id = $1
            LIMIT 1
            `,
            [user_id]
        );

        return res.status(200).json({
            success: true,
            address_exists: result.rows.length > 0
        });

    } catch (error) {

        console.log("checkUserAddExists Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};





export const replaceOrder = async (req, res) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const {
            order_id,
            order_item_id,
            reason,
            description,
        } = req.body;

        const user_id = req.user.id;

        if (
            !order_id ||
            !order_item_id ||
            !reason?.trim() ||
            !description?.trim()
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "All fields are required.",
            });
        }

        if (!req.file) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Product image is required.",
            });
        }

        // Verify order belongs to user and lock row
        const orderResult = await client.query(
            `
            SELECT id, order_status
            FROM orders
            WHERE id = $1
            AND user_id = $2
            FOR UPDATE
            `,
            [order_id, user_id]
        );

        if (orderResult.rowCount === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Order not found.",
            });
        }

        const order = orderResult.rows[0];

        // Replacement allowed only when out for delivery
        if (order.order_status !== "out_for_delivery") {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Replacement can only be requested for Out For Delivery orders.",
            });
        }

        // Verify item belongs to order
        const itemResult = await client.query(
            `
            SELECT id
            FROM order_items
            WHERE id = $1
            AND order_id = $2
            `,
            [order_item_id, order_id]
        );

        if (itemResult.rowCount === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Invalid order item.",
            });
        }

        // Prevent duplicate request
        const duplicate = await client.query(
            `
            SELECT id
            FROM replacement_requests
            WHERE order_item_id = $1
            AND status IN ('pending','approved')
            `,
            [order_item_id]
        );

        if (duplicate.rowCount > 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Replacement request already submitted.",
            });
        }

        // Upload image
        const uploadedImage = await uploadToCloudinary(req.file.buffer);

        if (!uploadedImage?.secure_url) {
            throw new Error("Image upload failed.");
        }

        // Insert replacement request
        await client.query(
            `
            INSERT INTO replacement_requests
            (
                order_id,
                order_item_id,
                user_id,
                reason,
                description,
                image
            )
            VALUES
            ($1,$2,$3,$4,$5,$6)
            `,
            [
                order_id,
                order_item_id,
                user_id,
                reason.trim(),
                description.trim(),
                uploadedImage.secure_url,
            ]
        );

        // Update order status
        await client.query(
            `
            UPDATE orders
            SET
                order_status = 'replace_requested'
            WHERE id = $1
            `,
            [order_id]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message: "Replacement request submitted successfully.",
        });

    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Replace Order Error:", error);

        return res.status(500).json({
            success: false,
            message: "Something went wrong. Please try again.",
        });

    } finally {
        client.release();
    }
};

export const viewReplacements = async (req, res) => {
    try {

        const replacements = await pool.query(`
SELECT
    rr.id,
    rr.order_id,
    rr.order_item_id,
    rr.reason,
    rr.description,
    rr.image,
    rr.status,
    rr.admin_remark,
    rr.created_at,

    wu.user_id,
    wu.name AS customer_name,
    wu.mobile,

    o.uuid AS order_uuid,
    o.payment_status,
    o.order_status,

    oi.quantity,
    oi.price,

    p.id AS product_id,
    p.p_title,
    p.p_slug,
    p.p_customer_price,
    p.p_sale_price,

    pi.index_image AS product_image

FROM replacement_requests rr

INNER JOIN orders o
    ON rr.order_id = o.id

INNER JOIN order_items oi
    ON rr.order_item_id = oi.id

INNER JOIN products p
    ON oi.product_id = p.id

LEFT JOIN product_images pi
    ON pi.product_id = p.id

INNER JOIN web_user wu
    ON rr.user_id = wu.user_id

ORDER BY rr.created_at DESC
`);

        return res.status(200).json({
            success: true,
            data: replacements.rows,
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });

    }
};

export const approveReplacement = async (req, res) => {
    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const { replacement_request_id } = req.body;

        if (!replacement_request_id) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Replacement request id is required."
            });

        }

        const replacement = await client.query(
            `
            SELECT
                id,
                order_id,
                status
            FROM replacement_requests
            WHERE id = $1
            FOR UPDATE
            `,
            [replacement_request_id]
        );

        if (replacement.rowCount === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Replacement request not found."
            });

        }

        const request = replacement.rows[0];

        if (request.status !== "pending") {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: `Replacement request already ${request.status}.`
            });

        }

        await client.query(
            `
            UPDATE replacement_requests
            SET
                status = 'approved',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [replacement_request_id]
        );

        await client.query(
            `
            UPDATE orders
            SET
                order_status = 'replacement_approved'
            WHERE id = $1
            `,
            [request.order_id]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message: "Replacement request approved successfully."
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });

    } finally {

        client.release();

    }
};

export const rejectReplacement = async (req, res) => {
    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const { replacement_request_id } = req.body;

        if (!replacement_request_id) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Replacement request id is required."
            });

        }

        const replacement = await client.query(
            `
            SELECT
                id,
                order_id,
                status
            FROM replacement_requests
            WHERE id = $1
            FOR UPDATE
            `,
            [replacement_request_id]
        );

        if (replacement.rowCount === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "Replacement request not found."
            });

        }

        const request = replacement.rows[0];

        if (request.status !== "pending") {

            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: `Replacement request already ${request.status}.`
            });

        }

        await client.query(
            `
            UPDATE replacement_requests
            SET
                status = 'rejected',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [replacement_request_id]
        );

        await client.query(
            `
            UPDATE orders
            SET
                order_status = 'replacement_rejected'
            WHERE id = $1
            `,
            [request.order_id]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message: "Replacement request rejected successfully."
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });

    } finally {

        client.release();

    }
};