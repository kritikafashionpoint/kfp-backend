import pool from "../../config/pgDb.js";
import { createNewCategoryService, DeleteCategoryService, UpdateCategoryService } from "./category_service.js";

export const createNewCategory = async (req, res) => {
    try {

        console.log(req.body);
        console.log(req.file)

        const result = await createNewCategoryService(req);

        return res.status(201).json({
            success: true,
            code: "CATEGORY_CREATED",
            msg: "Category created successfully",
        });

    } catch (error) {

        console.log(error.message || "Server Error");

        // Validation Errors
        if (error.message === "All fields are required") {
            return res.status(400).json({
                success: false,
                code: "VALIDATION_ERROR",
                msg: error.message
            });
        }

        // Slug Already Exists
        if (error.message === "Category slug already exists") {
            return res.status(409).json({
                success: false,
                code: "CATEGORY_ALREADY_EXISTS",
                msg: error.message
            });
        }

        // PostgreSQL Duplicate Error
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                code: "DUPLICATE_ENTRY",
                msg: "Duplicate entry found"
            });
        }

        // PostgreSQL Connection Error
        if (error.code === "ECONNREFUSED") {
            return res.status(500).json({
                success: false,
                code: "DATABASE_CONNECTION_ERROR",
                msg: "Database connection failed"
            });
        }

        // Default Server Error
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            msg: error.message || "Server Error"
        });
    }
};

export const viewAllCategories = async (req, res) => {

    try {

        // Fetch Categories
        const result = await pool.query(`
            SELECT *
            FROM categories
            ORDER BY created_at DESC
        `);

        // No Categories Found
        // if (result.rows.length === 0) {
        //     return res.status(404).json({
        //         success: false,
        //         code: "NO_CATEGORIES_FOUND",
        //         msg: "No categories found",
        //         data: []
        //     });
        // }

        // Success Response
        return res.status(200).json({
            success: true,
            code: "CATEGORIES_FETCHED",
            msg: "Categories fetched successfully",
            total: result.rows.length,
            data: result.rows
        });

    } catch (error) {

        console.log(error.message || "Server Error");

        // PostgreSQL Connection Error
        if (error.code === "ECONNREFUSED") {

            return res.status(500).json({
                success: false,
                code: "DATABASE_CONNECTION_ERROR",
                msg: "Database connection failed"
            });
        }

        // PostgreSQL Query Error
        if (error.code === "42P01") {

            return res.status(500).json({
                success: false,
                code: "TABLE_NOT_FOUND",
                msg: "Categories table not found"
            });
        }

        // Default Server Error
        return res.status(500).json({
            success: false,
            code: "SERVER_ERROR",
            msg: error.message || "Internal Server Error"
        });
    }
};

export const GetCategoryById = async (req, res) => {
    try {

        const { editId } = req.params;

        // Check if ID exists
        if (!editId) {
            return res.status(400).json({
                success: false,
                msg: "Category ID is required"
            });
        }

        // Get category by ID
        const result = await pool.query(
            `
            SELECT *
            FROM categories
            WHERE category_id = $1
            `,
            [editId]
        );

        // Check category exists or not
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                msg: "Category not found"
            });
        }

        // Success response
        return res.status(200).json({
            success: true,
            msg: "Category fetched successfully",
            data: result.rows[0]
        });

    } catch (error) {

        console.log(error.message || "Server Error");

        return res.status(500).json({
            success: false,
            msg: "Internal Server Error"
        });
    }
};

export const UpdateCategory = async (req, res) => {

    try {

        const result = await UpdateCategoryService(req);

        return res.status(200).json({
            success: true,
            msg: "Category updated successfully",
            data: result
        });

    } catch (error) {

        console.log(error.message || "Server Error");

        // VALIDATION ERROR
        if (error.code === "VALIDATION_ERROR") {

            return res.status(400).json({
                success: false,
                code: error.code,
                msg: error.message
            });
        }

        // CATEGORY NOT FOUND
        if (error.code === "CATEGORY_NOT_FOUND") {

            return res.status(404).json({
                success: false,
                code: error.code,
                msg: error.message
            });
        }

        // CATEGORY EXISTS
        if (error.code === "CATEGORY_ALREADY_EXISTS") {

            return res.status(409).json({
                success: false,
                code: error.code,
                msg: error.message
            });
        }

        // DATABASE ERROR
        if (error.code === "DATABASE_CONNECTION_ERROR") {

            return res.status(500).json({
                success: false,
                code: error.code,
                msg: error.message
            });
        }

        // DEFAULT ERROR
        return res.status(500).json({
            success: false,
            msg: "Internal Server Error"
        });

    }
};

export const DeleteCategory = async (req, res) => {

    try {

        const result = await DeleteCategoryService(req);

        return res.status(200).json({
            success: true,
            msg: "Category deleted successfully",
            data: result
        });

    } catch (error) {

        console.log(error.message || "Server Error");

        // VALIDATION ERROR
        if (error.code === "VALIDATION_ERROR") {
            return res.status(400).json({
                success: false,
                code: error.code,
                msg: error.message
            });
        }

        // NOT FOUND
        if (error.code === "CATEGORY_NOT_FOUND") {
            return res.status(404).json({
                success: false,
                code: error.code,
                msg: error.message
            });
        }

        // DATABASE ERROR
        if (error.code === "DATABASE_CONNECTION_ERROR") {
            return res.status(500).json({
                success: false,
                code: error.code,
                msg: error.message
            });
        }

        return res.status(500).json({
            success: false,
            msg: "Internal Server Error"
        });
    }
};

export const viewCategoryWiseProducts = async (req, res) => {

    try {

        const query = `
            SELECT
                c.category_id,
                c.category_name,
                c.category_slug,
                c.category_image,

                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', p.id,
                            'p_title', p.p_title,
                            'p_slug', p.p_slug,
                            'p_short_description', p.p_short_description,
                            'p_full_description', p.p_full_description,
                            'p_discount', p.p_discount,
                            'p_advance_payment', p.p_advance_payment,
                            'p_type', p.p_type,
                            'is_top_selling', p.is_top_selling,
                            'p_quantity', p.p_quantity,
                            'p_sale_price', p.p_sale_price,
                            'p_customer_price', p.p_customer_price,
                            'p_material', p.p_material,
                            'p_finishing', p.p_finishing,
                            'p_occasion', p.p_occasion,
                            'p_include_items', p.p_include_items,
                            'created_at', p.created_at,
                            'updated_at', p.updated_at,

                            'images',
                            json_build_object(
                                'index_image', pi.index_image,
                                'gallery_images', pi.gallery_images
                            )
                        )
                    ) FILTER (WHERE p.id IS NOT NULL),
                    '[]'
                ) AS products

            FROM categories c

            LEFT JOIN products p
            ON c.category_id = p.category_id

            LEFT JOIN product_images pi
            ON p.id = pi.product_id

            GROUP BY
                c.category_id,
                c.category_name,
                c.category_slug,
                c.category_image

            ORDER BY c.created_at DESC;
        `;

        const result = await pool.query(query);

        return res.status(200).json({
            success: true,
            message: "Category wise products fetched successfully",
            data: result.rows
        });

    } catch (error) {

        console.log("viewCategoryWiseProducts Error :", error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};