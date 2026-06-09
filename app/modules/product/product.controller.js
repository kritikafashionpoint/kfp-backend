// product.controller.js

import pool from "../../config/pgDB.js";
import { createProductService, deleteProductService, UpdateProductService } from "./product.service.js";

export const createProduct = async (req, res) => {

    try {

        // =========================
        // DEBUG
        // =========================

        console.log(req.body);
        console.log(req.files);

        // =========================
        // REQUIRED FIELD VALIDATION
        // =========================

        const {
            p_title,
            p_sale_price,
            p_customer_price,
        } = req.body;

        if (
            !p_title ||
            !p_sale_price ||
            !p_customer_price
        ) {

            return res.status(400).json({
                success: false,
                code: "VALIDATION_ERROR",
                msg: "Required fields are missing",
            });
        }

        // =========================
        // INDEX IMAGE VALIDATION
        // =========================

        if (
            !req.files ||
            !req.files.indexImage ||
            req.files.indexImage.length === 0
        ) {

            return res.status(400).json({
                success: false,
                code: "INDEX_IMAGE_REQUIRED",
                msg: "Index image is required",
            });
        }

        // =========================
        // CREATE PRODUCT
        // =========================

        const result =
            await createProductService(req);

        // =========================
        // SUCCESS RESPONSE
        // =========================

        return res.status(201).json({
            success: true,
            code: "PRODUCT_CREATED",
            msg: "Product created successfully",
            data: result,
        });

    } catch (error) {

        console.log(
            error.message || "Server Error"
        );

        // =========================
        // VALIDATION ERROR
        // =========================

        if (
            error.message ===
            "Index image is required"
        ) {

            return res.status(400).json({
                success: false,
                code: "INDEX_IMAGE_REQUIRED",
                msg: error.message,
            });
        }

        // =========================
        // CATEGORY ERROR
        // =========================

        if (
            error.message ===
            "Invalid category selected"
        ) {

            return res.status(400).json({
                success: false,
                code: "INVALID_CATEGORY",
                msg: error.message,
            });
        }

        // =========================
        // POSTGRESQL DUPLICATE
        // =========================

        if (
            error.message ===
            "Product slug already exists"
        ) {

            return res.status(409).json({
                success: false,
                code: "PRODUCT_SLUG_EXISTS",
                msg: error.message,
            });
        }

        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                code: "DUPLICATE_ENTRY",
                msg: "Duplicate entry found",
            });
        }

        // =========================
        // FOREIGN KEY ERROR
        // =========================

        if (error.code === "23503") {

            return res.status(400).json({
                success: false,
                code: "FOREIGN_KEY_ERROR",
                msg: "Invalid foreign key value",
            });
        }

        // =========================
        // NOT NULL ERROR
        // =========================

        if (error.code === "23502") {

            return res.status(400).json({
                success: false,
                code: "NULL_VALUE_ERROR",
                msg: `${error.column} is required`,
            });
        }

        // =========================
        // INVALID DATA TYPE
        // =========================

        if (error.code === "22P02") {

            return res.status(400).json({
                success: false,
                code: "INVALID_DATA_TYPE",
                msg: "Invalid data format",
            });
        }

        // =========================
        // DATABASE CONNECTION ERROR
        // =========================

        if (
            error.code === "ECONNREFUSED"
        ) {

            return res.status(500).json({
                success: false,
                code: "DATABASE_CONNECTION_ERROR",
                msg: "Database connection failed",
            });
        }

        // =========================
        // MULTER ERROR
        // =========================

        if (
            error.name === "MulterError"
        ) {

            return res.status(400).json({
                success: false,
                code: "FILE_UPLOAD_ERROR",
                msg: error.message,
            });
        }

        // =========================
        // CLOUDINARY ERROR
        // =========================

        if (
            error.http_code ||
            error.message?.includes(
                "cloudinary"
            )
        ) {

            return res.status(500).json({
                success: false,
                code: "CLOUDINARY_UPLOAD_ERROR",
                msg: "Image upload failed",
            });
        }

        // =========================
        // DEFAULT SERVER ERROR
        // =========================

        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            msg:
                error.message ||
                "Internal Server Error",
        });
    }
};

export const viewProducts = async (req, res) => {
    try {

        const result = await pool.query(`
            SELECT
    p.*,

    c.category_id,
    c.category_name,
    c.category_slug,
    c.category_image,

    pi.index_image,
    pi.gallery_images

FROM products p

LEFT JOIN categories c
    ON p.category_id = c.category_id

LEFT JOIN product_images pi
    ON p.id = pi.product_id

ORDER BY p.created_at DESC;
        `);

        return res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            data: result.rows,
        });

    } catch (error) {

        console.error("Error fetching products:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching products",
        });
    }
};

export const GetProductById = async (req, res) => {

    const { id } = req.params;

    try {

        const result = await pool.query(`
            
            SELECT 
                p.*,

                pi.index_image,
                pi.gallery_images

            FROM products p

            LEFT JOIN product_images pi
            ON p.id = pi.product_id

            WHERE p.id = $1

        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Product fetched successfully",
            data: result.rows[0],
        });

    } catch (error) {

        console.error("Error fetching product:", error.message);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching product",
        });
    }
};

export const UpdateProduct = async (req, res) => {

    try {

        const result =
            await UpdateProductService(req);

        return res.status(200).json({
            success: true,
            code: "PRODUCT_UPDATED",
            msg: "Product updated successfully",
            data: result
        });

    } catch (error) {

        console.log(
            "UPDATE PRODUCT ERROR =>",
            error
        );

        // ====================================
        // PRODUCT NOT FOUND
        // ====================================

        if (
            error.message ===
            "Product not found"
        ) {

            return res.status(404).json({
                success: false,
                code: "PRODUCT_NOT_FOUND",
                msg: "Product does not exist"
            });
        }

        // ====================================
        // SLUG EXISTS
        // ====================================

        if (
            error.message ===
            "Product slug already exists"
        ) {

            return res.status(409).json({
                success: false,
                code: "PRODUCT_SLUG_EXISTS",
                msg: "Product slug already exists"
            });
        }

        // ====================================
        // CLOUDINARY ERROR
        // ====================================

        if (
            error?.http_code ||
            error?.name ===
            "CloudinaryError"
        ) {

            return res.status(500).json({
                success: false,
                code: "CLOUDINARY_UPLOAD_ERROR",
                msg:
                    error.message ||
                    "Cloudinary upload failed"
            });
        }

        // ====================================
        // POSTGRES UNIQUE ERROR
        // ====================================

        if (error.code === "23505") {

            return res.status(409).json({
                success: false,
                code: "DUPLICATE_ENTRY",
                msg:
                    "Duplicate value violates unique constraint"
            });
        }

        // ====================================
        // INVALID UUID
        // ====================================

        if (error.code === "22P02") {

            return res.status(400).json({
                success: false,
                code: "INVALID_ID",
                msg: "Invalid product id"
            });
        }

        // ====================================
        // FOREIGN KEY ERROR
        // ====================================

        if (error.code === "23503") {

            return res.status(400).json({
                success: false,
                code: "INVALID_CATEGORY",
                msg:
                    "Selected category does not exist"
            });
        }

        // ====================================
        // NOT NULL ERROR
        // ====================================

        if (error.code === "23502") {

            return res.status(400).json({
                success: false,
                code: "MISSING_REQUIRED_FIELDS",
                msg:
                    "Required fields are missing"
            });
        }

        // ====================================
        // INVALID ENUM
        // ====================================

        if (error.code === "23514") {

            return res.status(400).json({
                success: false,
                code: "INVALID_PRODUCT_TYPE",
                msg:
                    "Invalid product type provided"
            });
        }

        // ====================================
        // MULTER FILE ERROR
        // ====================================

        if (
            error.name ===
            "MulterError"
        ) {

            return res.status(400).json({
                success: false,
                code: "FILE_UPLOAD_ERROR",
                msg:
                    error.message ||
                    "File upload failed"
            });
        }

        // ====================================
        // FILE SIZE ERROR
        // ====================================

        if (
            error.code ===
            "LIMIT_FILE_SIZE"
        ) {

            return res.status(400).json({
                success: false,
                code: "FILE_TOO_LARGE",
                msg:
                    "Uploaded file size is too large"
            });
        }

        // ====================================
        // VALIDATION ERROR
        // ====================================

        if (
            error.message?.includes(
                "validation"
            )
        ) {

            return res.status(400).json({
                success: false,
                code: "VALIDATION_ERROR",
                msg: error.message
            });
        }

        // ====================================
        // DEFAULT SERVER ERROR
        // ====================================

        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            msg:
                error.message ||
                "Internal Server Error"
        });
    }
};

export const deleteProduct = async (req, res) => {

    try {

        // =====================================
        // GET PRODUCT ID
        // =====================================

        const { id } = req.params;

        // =====================================
        // VALIDATE ID
        // =====================================

        if (!id) {

            return res.status(400).json({
                success: false,
                code: "INVALID_ID",
                msg: "Product ID is required"
            });
        }

        // =====================================
        // DELETE PRODUCT
        // =====================================

        const result =
            await deleteProductService(id);

        // =====================================
        // SUCCESS RESPONSE
        // =====================================

        return res.status(200).json({
            success: true,
            code: "PRODUCT_DELETED",
            msg:
                result.msg ||
                "Product deleted successfully"
        });

    } catch (error) {

        console.log(
            "DELETE PRODUCT CONTROLLER ERROR =>",
            error
        );

        // =====================================
        // PRODUCT NOT FOUND
        // =====================================

        if (
            error.message ===
            "Product not found"
        ) {

            return res.status(404).json({
                success: false,
                code: "PRODUCT_NOT_FOUND",
                msg: "Product not found"
            });
        }

        // =====================================
        // INVALID UUID
        // =====================================

        if (error.code === "22P02") {

            return res.status(400).json({
                success: false,
                code: "INVALID_ID",
                msg: "Invalid product ID format"
            });
        }

        // =====================================
        // CLOUDINARY ERROR
        // =====================================

        if (
            error.http_code ||
            error.name === "CloudinaryError"
        ) {

            return res.status(500).json({
                success: false,
                code: "CLOUDINARY_DELETE_ERROR",
                msg:
                    "Failed to delete images from Cloudinary"
            });
        }

        // =====================================
        // DATABASE ERROR
        // =====================================

        if (error.code?.startsWith("23")) {

            return res.status(500).json({
                success: false,
                code: "DATABASE_ERROR",
                msg:
                    "Database error while deleting product"
            });
        }

        // =====================================
        // SERVER ERROR
        // =====================================

        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            msg:
                error.message ||
                "Something went wrong"
        });
    }
};