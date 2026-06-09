import cloudinary from "../../config/cloudinary.js";
import { sendOtpMail } from "../../config/nodemailer.js"
import pool from "../../config/pgDB.js"
import bcrypt from "bcrypt";
import streamifier from "streamifier";

// category.service.js
export const createNewCategoryService = async (req) => {

    const { category_name, category_slug } = req.body;

    // Validation
    if (!category_name || !category_slug) {
        throw new Error("Category name and slug are required");
    }

    if (!req.file) {
        throw new Error("Category image is required");
    }

    // Check existing slug
    const checkSlugQuery = `
        SELECT * FROM categories
        WHERE category_slug = $1
    `;

    const checkSlug = await pool.query(
        checkSlugQuery,
        [category_slug]
    );

    if (checkSlug.rows.length > 0) {
        throw new Error("Category slug already exists");
    }

    // Upload image to cloudinary
    const uploadImageToCloudinary = async () => {

        return await new Promise((resolve, reject) => {

            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: "kritika-fashion-point/categories",
                },
                (error, result) => {

                    if (error) {
                        return reject(error);
                    }

                    return resolve(result);
                }
            );

            stream.end(req.file.buffer);
        });
    };

    const uploadedImage = await uploadImageToCloudinary();

    const imageUrl = uploadedImage.secure_url;

    // Insert Query
    const insertQuery = `
        INSERT INTO categories (
            category_name,
            category_slug,
            category_image
        )
        VALUES ($1, $2, $3)
        RETURNING *
    `;

    const values = [
        category_name,
        category_slug,
        imageUrl
    ];

    const result = await pool.query(
        insertQuery,
        values
    );

    return result.rows[0];
};

// SERVICE
export const UpdateCategoryService = async (req) => {

    try {

        const {
            category_id,
            category_name,
            category_slug
        } = req.body;

        // NEW IMAGE
        const newImage = req.file?.path || null;

        // VALIDATION
        if (
            !category_id ||
            !category_name ||
            !category_slug
        ) {

            const error = new Error(
                "All fields are required"
            );

            error.code = "VALIDATION_ERROR";

            throw error;
        }

        // CHECK CATEGORY EXISTS
        const categoryExist = await pool.query(
            `
            SELECT *
            FROM categories
            WHERE category_id = $1
            `,
            [category_id]
        );

        if (categoryExist.rows.length === 0) {

            const error = new Error(
                "Category not found"
            );

            error.code = "CATEGORY_NOT_FOUND";

            throw error;
        }

        // CHECK DUPLICATE SLUG
        const slugExist = await pool.query(
            `
            SELECT *
            FROM categories
            WHERE category_slug = $1
            AND category_id != $2
            `,
            [category_slug, category_id]
        );

        if (slugExist.rows.length > 0) {

            const error = new Error(
                "Category slug already exists"
            );

            error.code = "CATEGORY_ALREADY_EXISTS";

            throw error;
        }

        // OLD CATEGORY DATA
        const oldCategory = categoryExist.rows[0];

        let finalImage = oldCategory.category_image;

        // IF NEW IMAGE EXISTS
        if (newImage) {

            // DELETE OLD IMAGE FROM CLOUDINARY
            if (oldCategory.category_image) {

                try {

                    const splitUrl =
                        oldCategory.category_image.split("/");

                    const imageName =
                        splitUrl[splitUrl.length - 1];

                    const publicId =
                        imageName.split(".")[0];

                    await cloudinary.uploader.destroy(
                        publicId
                    );

                } catch (cloudinaryError) {

                    console.log(
                        "Cloudinary Delete Error:",
                        cloudinaryError.message
                    );
                }
            }

            // SET NEW IMAGE
            finalImage = newImage;
        }

        // UPDATE CATEGORY
        const result = await pool.query(
            `
            UPDATE categories
            SET
                category_name = $1,
                category_slug = $2,
                category_image = $3
            WHERE category_id = $4
            RETURNING *
            `,
            [
                category_name,
                category_slug,
                finalImage,
                category_id
            ]
        );

        return result.rows[0];

    } catch (error) {

        console.log(error.message);

        // POSTGRES ERROR
        if (error.code?.startsWith?.("23")) {

            const customError = new Error(
                "Database constraint error"
            );

            customError.code =
                "DATABASE_CONNECTION_ERROR";

            throw customError;
        }

        throw error;
    }
};

export const DeleteCategoryService = async (req) => {

    try {

        const { category_id } = req.params;

        // VALIDATION
        if (!category_id) {
            const error = new Error("Category ID is required");
            error.code = "VALIDATION_ERROR";
            throw error;
        }

        // CHECK CATEGORY EXISTS
        const categoryExist = await pool.query(
            `
            SELECT *
            FROM categories
            WHERE category_id = $1
            `,
            [category_id]
        );

        if (categoryExist.rows.length === 0) {
            const error = new Error("Category not found");
            error.code = "CATEGORY_NOT_FOUND";
            throw error;
        }

        const category = categoryExist.rows[0];

        // DELETE IMAGE FROM CLOUDINARY (if exists)
        if (category.category_image) {

            try {

                // EXAMPLE URL:
                // https://res.cloudinary.com/demo/image/upload/v123456/categories/abc123.jpg

                const urlParts = category.category_image.split("/upload/")[1];

                // REMOVE VERSION
                const publicIdWithExtension = urlParts.replace(/^v\d+\//, "");

                // REMOVE FILE EXTENSION
                const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, "");

                console.log("Deleting Cloudinary Image:", publicId);

                await cloudinary.uploader.destroy(publicId);

            } catch (cloudErr) {
                console.log("Cloudinary delete error:", cloudErr.message);
            }
        }

        // DELETE FROM DB
        const result = await pool.query(
            `
            DELETE FROM categories
            WHERE category_id = $1
            RETURNING *
            `,
            [category_id]
        );

        return result.rows[0];

    } catch (error) {

        console.log(error.message);

        if (error.code?.startsWith("23")) {
            const customError = new Error("Database error");
            customError.code = "DATABASE_CONNECTION_ERROR";
            throw customError;
        }

        throw error;
    }
};