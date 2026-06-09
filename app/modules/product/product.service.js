// product.service.js

import cloudinary from "../../config/cloudinary.js";
import pool from "../../config/pgDb.js";
import streamifier from "streamifier";



export const createProductService = async (req) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        // =========================
        // BODY DATA
        // =========================

        const {
            p_title,
            p_slug,
            p_short_description,
            p_full_description,
            p_discount,
            p_advance_payment,
            p_type,
            is_top_selling,
            p_quantity,
            p_sale_price,
            p_customer_price,
            p_material,
            p_finishing,
            p_occasion,
            p_include_items,
            category_id,
        } = req.body;

        // =========================
        // CHECK SLUG EXISTS
        // =========================

        const checkSlugQuery = `
            SELECT id
            FROM products
            WHERE p_slug = $1
        `;

        const checkSlug =
            await client.query(
                checkSlugQuery,
                [p_slug]
            );

        if (checkSlug.rows.length > 0) {

            throw new Error(
                "Product slug already exists"
            );
        }

        // =========================
        // FILES
        // =========================

        const indexImageFile =
            req.files?.indexImage?.[0];

        const galleryImageFiles =
            req.files?.galleryImages || [];

        if (!indexImageFile) {

            throw new Error(
                "Index image is required"
            );
        }

        // =========================
        // CLOUDINARY UPLOAD FUNCTION
        // =========================

        const uploadToCloudinary = (
            file,
            folder
        ) => {

            return new Promise(
                (resolve, reject) => {

                    const stream =
                        cloudinary.uploader.upload_stream(
                            {
                                folder,
                            },

                            (
                                error,
                                result
                            ) => {

                                if (error) {

                                    reject(error);

                                } else {

                                    resolve(result);
                                }
                            }
                        );

                    streamifier
                        .createReadStream(
                            file.buffer
                        )
                        .pipe(stream);
                }
            );
        };

        // =========================
        // UPLOAD INDEX IMAGE
        // =========================

        const uploadedIndexImage =
            await uploadToCloudinary(
                indexImageFile,
                "kritika-fashion-point/products/index-images"
            );

        const index_image =
            uploadedIndexImage.secure_url;

        // =========================
        // UPLOAD GALLERY IMAGES
        // =========================

        const gallery_images = [];

        for (const file of galleryImageFiles) {

            const uploadedImage =
                await uploadToCloudinary(
                    file,
                    "kritika-fashion-point/products/gallery-images"
                );

            gallery_images.push(
                uploadedImage.secure_url
            );
        }

        // =========================
        // INSERT PRODUCT
        // =========================

        const productQuery = `
            INSERT INTO products (
                p_title,
                p_slug,
                p_short_description,
                p_full_description,
                p_discount,
                p_advance_payment,
                p_type,
                is_top_selling,
                p_quantity,
                p_sale_price,
                p_customer_price,
                p_material,
                p_finishing,
                p_occasion,
                p_include_items,
                category_id
            )

            VALUES (
                $1,$2,$3,$4,$5,$6,$7,
                $8,$9,$10,$11,$12,$13,
                $14,$15,$16
            )

            RETURNING *
        `;

        const productValues = [
            p_title,
            p_slug,
            p_short_description,
            p_full_description,

            p_discount
                ? Number(p_discount)
                : null,

            p_advance_payment
                ? Number(p_advance_payment)
                : null,

            p_type,

            is_top_selling === "true" ||
            is_top_selling === true,

            Number(p_quantity),

            Number(p_sale_price),

            Number(p_customer_price),

            p_material,

            p_finishing,

            p_occasion,

            p_include_items,

            category_id || null,
        ];

        const productResult =
            await client.query(
                productQuery,
                productValues
            );

        const createdProduct =
            productResult.rows[0];

        // =========================
        // INSERT PRODUCT IMAGES
        // =========================

        const imageQuery = `
            INSERT INTO product_images (
                product_id,
                index_image,
                gallery_images
            )

            VALUES ($1,$2,$3)

            RETURNING *
        `;

        const imageValues = [
            createdProduct.id,
            index_image,
            gallery_images,
        ];

        const imageResult =
            await client.query(
                imageQuery,
                imageValues
            );

        // =========================
        // COMMIT
        // =========================

        await client.query("COMMIT");

        return {
            success: true,

            product:
                productResult.rows[0],

            images:
                imageResult.rows[0],
        };

    } catch (error) {

        // =========================
        // ROLLBACK
        // =========================

        await client.query("ROLLBACK");

        throw error;

    } finally {

        client.release();
    }
};

export const UpdateProductService = async (req) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const { id } = req.params;

        // =========================
        // VALIDATE ID
        // =========================

        if (!id || id === "undefined") {

            const error = new Error(
                "Invalid product id"
            );

            error.code = "INVALID_ID";

            throw error;
        }

        const {
            p_title,
            p_slug,
            p_short_description,
            p_full_description,
            p_type,
            is_top_selling,
            p_quantity,
            p_sale_price,
            p_customer_price,
            p_discount,
            p_advance_payment,
            p_material,
            p_finishing,
            p_occasion,
            p_include_items,
            category_id,
        } = req.body;

        // =========================
        // CHECK PRODUCT EXISTS
        // =========================

        const existingProductQuery =
            await client.query(
                `
                SELECT
                    p.*,
                    pi.index_image,
                    pi.gallery_images

                FROM products p

                LEFT JOIN product_images pi
                ON p.id = pi.product_id

                WHERE p.id = $1
                `,
                [id]
            );

        if (
            existingProductQuery.rows.length === 0
        ) {

            const error = new Error(
                "Product not found"
            );

            error.code = "PRODUCT_NOT_FOUND";

            throw error;
        }

        const existingProduct =
            existingProductQuery.rows[0];

        // =========================
        // CHECK SLUG EXISTS
        // =========================

        const checkSlug = await client.query(
            `
            SELECT id
            FROM products
            WHERE p_slug = $1
            AND id != $2
            `,
            [p_slug, id]
        );

        if (checkSlug.rows.length > 0) {

            const error = new Error(
                "Product slug already exists"
            );

            error.code =
                "PRODUCT_SLUG_EXISTS";

            throw error;
        }

        // =========================
        // CLOUDINARY HELPERS
        // =========================

        const uploadToCloudinary = (
            file,
            folder
        ) => {

            return new Promise(
                (resolve, reject) => {

                    const stream =
                        cloudinary.uploader.upload_stream(
                            {
                                folder,
                            },

                            (
                                error,
                                result
                            ) => {

                                if (error) {

                                    reject(error);

                                } else {

                                    resolve(result);
                                }
                            }
                        );

                    streamifier
                        .createReadStream(
                            file.buffer
                        )
                        .pipe(stream);
                }
            );
        };

        const extractPublicId = (url) => {

            if (!url) return null;

            try {

                const urlParts =
                    url.split("/upload/")[1];

                const publicId =
                    urlParts
                        .split(".")[0]
                        .replace(
                            /v\d+\//,
                            ""
                        );

                return publicId;

            } catch (error) {

                return null;
            }
        };

        // =========================
        // KEEP OLD IMAGES
        // =========================

        let indexImageUrl =
            existingProduct.index_image;

        let galleryImageUrls =
            existingProduct.gallery_images ||
            [];

        // =========================
        // UPDATE INDEX IMAGE
        // =========================

        if (
            req.files?.indexImage?.[0]
        ) {

            // DELETE OLD IMAGE

            if (
                existingProduct.index_image
            ) {

                const oldPublicId =
                    extractPublicId(
                        existingProduct.index_image
                    );

                if (oldPublicId) {

                    await cloudinary.uploader.destroy(
                        oldPublicId
                    );
                }
            }

            // UPLOAD NEW IMAGE

            const uploadedIndexImage =
                await uploadToCloudinary(
                    req.files.indexImage[0],
                    "kritika-fashion-point/products/index-images"
                );

            indexImageUrl =
                uploadedIndexImage.secure_url;
        }

        // =========================
        // UPDATE GALLERY IMAGES
        // =========================

        if (
            req.files?.galleryImages &&
            req.files.galleryImages.length > 0
        ) {

            // DELETE OLD GALLERY IMAGES

            if (
                existingProduct.gallery_images &&
                existingProduct.gallery_images
                    .length > 0
            ) {

                for (const imageUrl of existingProduct.gallery_images) {

                    const oldPublicId =
                        extractPublicId(
                            imageUrl
                        );

                    if (oldPublicId) {

                        await cloudinary.uploader.destroy(
                            oldPublicId
                        );
                    }
                }
            }

            // UPLOAD NEW GALLERY IMAGES

            galleryImageUrls = [];

            for (const file of req.files.galleryImages) {

                const uploadedImage =
                    await uploadToCloudinary(
                        file,
                        "kritika-fashion-point/products/gallery-images"
                    );

                galleryImageUrls.push(
                    uploadedImage.secure_url
                );
            }
        }

        // =========================
        // UPDATE PRODUCT
        // =========================

        const updatedProduct =
            await client.query(
                `
                UPDATE products
                SET
                    p_title = $1,
                    p_slug = $2,
                    p_short_description = $3,
                    p_full_description = $4,
                    p_type = $5,
                    is_top_selling = $6,
                    p_quantity = $7,
                    p_sale_price = $8,
                    p_customer_price = $9,
                    p_discount = $10,
                    p_advance_payment = $11,
                    p_material = $12,
                    p_finishing = $13,
                    p_occasion = $14,
                    p_include_items = $15,
                    category_id = $16,
                    updated_at = CURRENT_TIMESTAMP

                WHERE id = $17

                RETURNING *
                `,
                [
                    p_title,

                    p_slug,

                    p_short_description,

                    p_full_description,

                    p_type,

                    is_top_selling ===
                    "true" ||
                    is_top_selling ===
                    true,

                    p_quantity
                        ? Number(
                            p_quantity
                        )
                        : 0,

                    p_sale_price
                        ? Number(
                            p_sale_price
                        )
                        : 0,

                    p_customer_price
                        ? Number(
                            p_customer_price
                        )
                        : 0,

                    p_discount
                        ? Number(
                            p_discount
                        )
                        : null,

                    p_advance_payment
                        ? Number(
                            p_advance_payment
                        )
                        : null,

                    p_material,
                    p_finishing,
                    p_occasion,
                    p_include_items,

                    category_id &&
                        category_id !==
                        "undefined"
                        ? category_id
                        : null,

                    id,
                ]
            );

        // =========================
        // UPDATE PRODUCT IMAGES
        // =========================

        const checkImageExists =
            await client.query(
                `
                SELECT *
                FROM product_images
                WHERE product_id = $1
                `,
                [id]
            );

        // UPDATE

        if (
            checkImageExists.rows.length > 0
        ) {

            await client.query(
                `
                UPDATE product_images
                SET
                    index_image = $1,
                    gallery_images = $2

                WHERE product_id = $3
                `,
                [
                    indexImageUrl,
                    galleryImageUrls,
                    id,
                ]
            );
        }

        // INSERT IF NOT EXISTS

        else {

            await client.query(
                `
                INSERT INTO product_images (
                    product_id,
                    index_image,
                    gallery_images
                )

                VALUES ($1,$2,$3)
                `,
                [
                    id,
                    indexImageUrl,
                    galleryImageUrls,
                ]
            );
        }

        // =========================
        // COMMIT
        // =========================

        await client.query("COMMIT");

        return {
            success: true,

            product:
                updatedProduct.rows[0],

            images: {
                index_image:
                    indexImageUrl,

                gallery_images:
                    galleryImageUrls,
            },
        };

    } catch (error) {

        await client.query("ROLLBACK");

        console.log(
            "UPDATE PRODUCT ERROR =>",
            error
        );

        throw error;

    } finally {

        client.release();
    }
};

export const deleteProductService = async (id) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        // =====================================
        // GET PRODUCT + IMAGES
        // =====================================

        const productQuery = await client.query(
            `
                SELECT 
                    p.id,
                    pi.index_image,
                    pi.gallery_images

                FROM products p

                LEFT JOIN product_images pi
                ON p.id = pi.product_id

                WHERE p.id = $1
            `,
            [id]
        );

        if (productQuery.rows.length === 0) {
            throw new Error("Product not found");
        }

        const product = productQuery.rows[0];

        // =====================================
        // EXTRACT CLOUDINARY PUBLIC ID
        // =====================================

        const extractPublicId = (url) => {

            if (!url) return null;

            try {

                // SPLIT AFTER upload/
                const urlParts = url.split("/upload/")[1];

                // REMOVE VERSION (v123456/)
                const withoutVersion =
                    urlParts.replace(/^v\d+\//, "");

                // REMOVE FILE EXTENSION
                const publicId =
                    withoutVersion.replace(/\.[^/.]+$/, "");

                return publicId;

            } catch (error) {

                console.log(
                    "PUBLIC ID EXTRACTION ERROR =>",
                    error.message
                );

                return null;
            }
        };

        // =====================================
        // DELETE INDEX IMAGE
        // =====================================

        if (product.index_image) {

            const publicId =
                extractPublicId(product.index_image);

            if (publicId) {

                await cloudinary.uploader.destroy(
                    publicId
                );
            }
        }

        // =====================================
        // DELETE GALLERY IMAGES
        // =====================================

        if (
            product.gallery_images &&
            product.gallery_images.length > 0
        ) {

            for (const imageUrl of product.gallery_images) {

                const publicId =
                    extractPublicId(imageUrl);

                if (publicId) {

                    await cloudinary.uploader.destroy(
                        publicId
                    );
                }
            }
        }

        // =====================================
        // DELETE PRODUCT IMAGES
        // =====================================

        await client.query(
            `
                DELETE FROM product_images
                WHERE product_id = $1
            `,
            [id]
        );

        // =====================================
        // DELETE PRODUCT
        // =====================================

        await client.query(
            `
                DELETE FROM products
                WHERE id = $1
            `,
            [id]
        );

        // =====================================
        // COMMIT
        // =====================================

        await client.query("COMMIT");

        return {
            success: true,
            msg: "Product deleted successfully"
        };

    } catch (error) {

        await client.query("ROLLBACK");

        console.log(
            "DELETE PRODUCT ERROR =>",
            error
        );

        throw error;

    } finally {

        client.release();
    }
};