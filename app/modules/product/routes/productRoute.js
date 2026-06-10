// product.routes.js

import express from "express";
import upload from "../../../utils/cloudinary_upload.js";
import { createProduct, deleteProduct, fetchProductBySlug, GetProductById, UpdateProduct, viewProducts } from "../product.controller.js";

const productRoute = express.Router();

productRoute.post(
    "/create-product",
    upload.fields([
        { name: "indexImage", maxCount: 1 },
        { name: "galleryImages", maxCount: 20 },
    ]),
    createProduct
);

productRoute.get('/view-products', viewProducts)
productRoute.get('/get-product/:id', GetProductById)

productRoute.post('/update-product/:id', upload.fields([
    { name: "indexImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 20 },
]), UpdateProduct)

productRoute.post('/delete-product/:id', deleteProduct)

productRoute.get('/slug/:slug', fetchProductBySlug)





export default productRoute;