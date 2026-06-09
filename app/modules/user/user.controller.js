import pool from "../../config/pgDb.js";
import {
    addtoCartService,
    addToWishlistService,
    createUserService,
    loginUserService,
    removeFromCartService,
    sendOtpService,
    verifyOtpService,
    viewCartService,
    viewWishListService
} from "./user.service.js";

export const createUser = async (req, res) => {
    try {
        const result = await createUserService(req);

        return res.status(result.code).json({
            status: result.status,
            code: result.code,
            message: result.message,
            data: result.data || null,
        });

    } catch (error) {
        console.error("Create User Error:", error);

        return res.status(500).json({
            status: false,
            code: 500,
            message: "Internal Server Error",
            data: null,
        });
    }
};

export const sendOtp = async (req, res) => {
    try {
        const result = await sendOtpService(req);

        return res.status(result.code).json({
            status: result.status,
            code: result.code,
            message: result.message,
            data: result.data || null,
        });

    } catch (error) {
        console.error("Send OTP Error:", error);

        return res.status(500).json({
            status: false,
            code: 500,
            message: "Failed to send OTP",
            data: null,
        });
    }
};

export const verifyOtp = async (req, res) => {
    try {
        const result = await verifyOtpService(req);

        return res.status(result.code).json({
            status: result.status,
            code: result.code,
            message: result.message,
            data: result.data || null,
        });

    } catch (error) {
        console.error("Verify OTP Error:", error);

        return res.status(500).json({
            status: false,
            code: 500,
            message: "OTP verification failed",
            data: null,
        });
    }
};


export const loginUser = async (req, res) => {
    try {
        const result = await loginUserService(req);

        return res.status(result.code).json(result);
    } catch (error) {
        return res.status(500).json({
            status: false,
            message: error.message,
        });
    }
};

export const viewAllUsers = async (req, res) => {
    try {

        const users = await pool.query(`
            SELECT
                user_id,
                name,
                mobile,
                email,
                is_verified,
                created_at,
                updated_at
            FROM web_user
            ORDER BY created_at DESC
        `);

        return res.status(200).json({
            status: true,
            message: "Users fetched successfully",
            data: users.rows,
        });

    } catch (error) {

        console.error("View Users Error:", error);

        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
        });

    }
};

export const addtoCart = async (req, res) => {
    try {
        const result = await addtoCartService(req);

        return res.status(result.code).json({
            success: result.status,   // ✅ FIXED
            message: result.message,
            data: result.data || null,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            data: null,
        });
    }
};

export const viewCart = async (req, res) => {
    try {
        const result = await viewCartService(req);

        return res.status(result.code).json({
            success: result.status,
            message: result.message,
            data: result.data || null,
        });

    } catch (error) {
        console.error("View Cart Controller Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            data: null,
        });
    }
};

export const removeFromCart = async (req, res) => {
    try {
        const result = await removeFromCartService(req);

        // if service returns failure
        if (!result?.success) {
            return res.status(400).json({
                success: false,
                message: result?.message || "Failed to remove item from cart",
            });
        }

        // if nothing was deleted (item not found)
        if (!result.data) {
            return res.status(404).json({
                success: false,
                message: "Cart item not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: result.data,
        });

    } catch (error) {
        console.error("removeFromCart controller error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error while removing item from cart",
            error: error.message,
        });
    }
};

export const addToWishlist = async (req, res) => {
    try {
        const result = await addToWishlistService(req);

        return res.status(result.code).json({
            success: result.status,
            message: result.message,
            data: result.data || null,
            isWishlisted: result.isWishlisted
        });
        console.log(result)

    } catch (error) {
        console.error("Add To Wishlist Controller Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};

export const viewWishList = async (req, res) => {
    try {
        const result = await viewWishListService(req);

        return res.status(result.code).json({
            success: result.status,
            message: result.message,
            data: result.data || [],
        });

    } catch (error) {
        console.error("View Wishlist Controller Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
};