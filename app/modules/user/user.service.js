import { sendOtpMail, sendOtpMailForWebUser } from "../../config/nodemailer.js";
import pool from "../../config/pgDB.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const otpStore = new Map();

export const createUserService = async (req) => {
    let {
        name,
        mobile,
        password,
    } = req.body;

    // Remove spaces, +, -, brackets etc.
    mobile = mobile?.replace(/\D/g, "");

    // Handle Indian country code
    if (mobile.length === 12 && mobile.startsWith("91")) {
        mobile = mobile.slice(2);
    }

    if (!name || !mobile || !password) {
        return {
            status: false,
            code: 400,
            message: "All fields are required",
        };
    }

    // Indian mobile validation
    if (!/^[6-9]\d{9}$/.test(mobile)) {
        return {
            status: false,
            code: 400,
            message: "Invalid mobile number",
        };
    }

    const existingUser = await pool.query(
        `
        SELECT mobile
        FROM web_user
        WHERE mobile = $1
        `,
        [mobile]
    );

    if (existingUser.rows.length > 0) {
        return {
            status: false,
            code: 409,
            message: "Mobile number already registered",
        };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
        `
        INSERT INTO web_user
        (
            name,
            mobile,
            password,
            is_verified
        )
        VALUES
        (
            $1,$2,$3,true
        )
        RETURNING *
        `,
        [
            name,
            mobile, // Saved as clean 10-digit number
            hashedPassword,
        ]
    );

    delete result.rows[0].password;

    return {
        status: true,
        code: 201,
        message: "Registration Successful, Please Login To Continue",
        data: result.rows[0],
    };
};

export const sendOtpService = async (req) => {
    const { name, mobile, email } = req.body;

    if (!name || !mobile || !email) {
        return {
            status: false,
            code: 400,
            message: "All fields are required",
        };
    }

    const existingUser = await pool.query(
        `
        SELECT *
        FROM web_user
        WHERE email = $1
        OR mobile = $2
        `,
        [email, mobile]
    );

    if (existingUser.rows.length > 0) {
        return {
            status: false,
            code: 409,
            message: "User already exists",
        };
    }

    const otp = Math.floor(
        100000 + Math.random() * 900000
    ).toString();

    otpStore.set(email, {
        otp,
        name,
        mobile,
        verified: false,
        expiresAt: Date.now() + 10 * 60 * 1000,
    });

    await sendOtpMailForWebUser(email, otp);

    return {
        status: true,
        code: 200,
        message: "OTP sent successfully",
    };
};

export const verifyOtpService = async (req) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return {
            status: false,
            code: 400,
            message: "Email and OTP are required",
        };
    }

    const otpData = otpStore.get(email);

    if (!otpData) {
        return {
            status: false,
            code: 404,
            message: "OTP not found",
        };
    }

    if (Date.now() > otpData.expiresAt) {
        otpStore.delete(email);

        return {
            status: false,
            code: 410,
            message: "OTP expired",
        };
    }

    if (otpData.otp !== otp) {
        return {
            status: false,
            code: 401,
            message: "Invalid OTP",
        };
    }

    otpData.verified = true;

    otpStore.set(email, otpData);

    return {
        status: true,
        code: 200,
        message: "OTP verified successfully",
    };
};

export const loginUserService = async (req) => {

    let { phone, password } = req.body;

    // Remove spaces, +, -, brackets etc.
    phone = phone?.replace(/\D/g, "");

    // Handle Indian country code
    if (phone.length === 12 && phone.startsWith("91")) {
        phone = phone.slice(2);
    }

    if (!phone || !password) {
        return {
            status: false,
            code: 400,
            message: "Phone and password are required",
        };
    }

    // Indian mobile validation
    if (!/^[6-9]\d{9}$/.test(phone)) {
        return {
            status: false,
            code: 400,
            message: "Invalid mobile number",
        };
    }

    const user = await pool.query(
        `
        SELECT *
        FROM web_user
        WHERE mobile = $1
        `,
        [phone]
    );

    if (user.rows.length === 0) {
        return {
            status: false,
            code: 404,
            message: "User not found",
        };
    }

    const userData = user.rows[0];

    const isPasswordMatch = await bcrypt.compare(
        password,
        userData.password
    );

    if (!isPasswordMatch) {
        return {
            status: false,
            code: 401,
            message: "Invalid password",
        };
    }

    const token = jwt.sign(
        {
            id: userData.user_id,
            mobile: userData.mobile,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "7d",
        }
    );

    delete userData.password;

    return {
        status: true,
        code: 200,
        message: "Login successful",
        token,
        data: userData,
    };
};



export const addtoCartService = async (req) => {
    try {

        const {
            product_id,
            quantity,
        } = req.body;

        const user_id = req.user.id

        if (!user_id || !product_id) {
            return {
                status: false,
                code: 400,
                message: "User ID and Product ID are required",
            };
        }

        const finalQuantity = quantity || 1;

        const existingCartItem = await pool.query(
            `
            SELECT *
            FROM cart
            WHERE user_id = $1
            AND product_id = $2
            `,
            [user_id, product_id]
        );

        // Product already exists in cart
        if (existingCartItem.rows.length > 0) {

            const updatedCart = await pool.query(
                `
                UPDATE cart
                SET
                    quantity = quantity + $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE cart_id = $2
                RETURNING *
                `,
                [
                    finalQuantity,
                    existingCartItem.rows[0].cart_id,
                ]
            );

            return {
                status: true,
                code: 200,
                message: "Cart quantity updated successfully",
                data: updatedCart.rows[0],
            };
        }

        // Add new item
        const cart = await pool.query(
            `
            INSERT INTO cart (
                user_id,
                product_id,
                quantity
            )
            VALUES ($1, $2, $3)
            RETURNING *
            `,
            [
                user_id,
                product_id,
                finalQuantity,
            ]
        );

        return {
            status: true,
            code: 201,
            message: "Product added to cart successfully",
            data: cart.rows[0],
        };

    } catch (error) {

        console.error("Add To Cart Error:", error);

        return {
            status: false,
            code: 500,
            message: error.message || "Internal Server Error",
        };
    }
};


export const viewCartService = async (req) => {
    try {
        const user_id = req.user.id;

        if (!user_id) {
            return {
                status: false,
                code: 400,
                message: "User ID is required",
            };
        }

        const cartItems = await pool.query(
            `
    SELECT 
        c.cart_id,
        c.product_id,
        c.quantity,
        c.created_at,
        c.updated_at,

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
        p.category_id,

        cat.category_id AS category_id,
        cat.category_name,
        cat.category_slug,
        cat.category_image,

        COALESCE(
            json_build_object(
                'index_image', pi.index_image,
                'gallery_images', pi.gallery_images
            ),
            '{}'::json
        ) AS images,

        (c.quantity * p.p_customer_price) AS subtotal

    FROM cart c

    INNER JOIN products p 
        ON p.id = c.product_id

    LEFT JOIN categories cat 
        ON cat.category_id = p.category_id

    LEFT JOIN product_images pi 
        ON pi.product_id = p.id

    WHERE c.user_id = $1

    GROUP BY 
        c.cart_id,
        c.product_id,
        c.quantity,
        c.created_at,
        c.updated_at,

        p.id,
        p.p_title,
        p.p_slug,
        p.p_short_description,
        p.p_full_description,
        p.p_discount,
        p.p_type,
        p.is_top_selling,
        p.p_quantity,
        p.p_sale_price,
        p.p_customer_price,
        p.p_material,
        p.p_finishing,
        p.p_occasion,
        p.p_include_items,
        p.category_id,

        cat.category_id,
        cat.category_name,
        cat.category_slug,
        cat.category_image,

        pi.index_image,
        pi.gallery_images

    ORDER BY c.created_at DESC
    `,
            [user_id]
        );

        const items = cartItems.rows;

        // calculate total cart value
        const total = items.reduce((acc, item) => {
            return acc + Number(item.subtotal);
        }, 0);

        return {
            status: true,
            code: 200,
            message: "Cart fetched successfully",
            data: {
                items,
                total,
                count: items.length,
            },
        };

    } catch (error) {
        console.error("View Cart Error:", error);

        return {
            status: false,
            code: 500,
            message: error.message || "Internal Server Error",
        };
    }
};


export const removeFromCartService = async (req) => {
    const { p_id } = req.params;
    const id = req.user.id;

    try {
        const result = await pool.query(
            `
            DELETE FROM cart
            WHERE product_id = $1
            AND user_id = $2
            RETURNING *
            `,
            [p_id, id]
        );

        return {
            success: true,
            message: "Item removed from cart successfully",
            data: result.rows[0] || null
        };

    } catch (error) {
        console.error("Remove from cart error:", error);

        return {
            success: false,
            message: "Failed to remove item from cart"
        };
    }
};


export const addToWishlistService = async (req) => {
    try {
        const user_id = req.user.id;
        const { id: product_id } = req.params;

        if (!product_id) {
            return {
                status: false,
                code: 400,
                message: "Product ID is required",
            };
        }

        const productExists = await pool.query(
            `
            SELECT id
            FROM products
            WHERE id = $1
            `,
            [product_id]
        );

        if (productExists.rows.length === 0) {
            return {
                status: false,
                code: 404,
                message: "Product not found",
            };
        }

        const wishlistItem = await pool.query(
            `
            SELECT wishlist_id
            FROM wishlist
            WHERE user_id = $1
            AND product_id = $2
            `,
            [user_id, product_id]
        );

        // Remove from wishlist
        if (wishlistItem.rows.length > 0) {
            await pool.query(
                `
                DELETE FROM wishlist
                WHERE user_id = $1
                AND product_id = $2
                `,
                [user_id, product_id]
            );

            return {
                status: true,
                code: 200,
                message: "Product removed from wishlist",
                isWishlisted: false,
            };
        }

        // Add to wishlist
        const result = await pool.query(
            `
            INSERT INTO wishlist (
                user_id,
                product_id
            )
            VALUES ($1, $2)
            RETURNING *
            `,
            [user_id, product_id]
        );

        return {
            status: true,
            code: 201,
            message: "Product added to wishlist",
            isWishlisted: true,
            data: result.rows[0],
        };

    } catch (error) {
        console.error("Add To Wishlist Service Error:", error);

        return {
            status: false,
            code: 500,
            message: "Internal Server Error",
        };
    }
};

export const viewWishListService = async (req) => {
    try {
        const user_id = req.user.id;

        const result = await pool.query(
            `
            SELECT
                w.wishlist_id,
                w.created_at AS wishlist_created_at,

                p.id,
                p.p_title,
                p.p_slug,
                p.p_short_description,
                p.p_discount,
                p.p_advance_payment,
                p.p_sale_price,
                p.p_customer_price,
                p.p_quantity,
                p.is_top_selling,
                p_discount,

                pi.index_image,
                pi.gallery_images

            FROM wishlist w

            INNER JOIN products p
                ON w.product_id = p.id

            LEFT JOIN product_images pi
                ON p.id = pi.product_id

            WHERE w.user_id = $1

            ORDER BY w.created_at DESC
            `,
            [user_id]
        );

        return {
            status: true,
            code: 200,
            message: "Wishlist fetched successfully",
            data: result.rows,
        };

    } catch (error) {
        console.error("View Wishlist Service Error:", error);

        return {
            status: false,
            code: 500,
            message: "Internal Server Error",
        };
    }
};