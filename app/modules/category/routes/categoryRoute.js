import express from "express";
import upload from "../../../utils/cloudinary_upload.js";
import { createNewCategory, DeleteCategory, GetCategoryById, UpdateCategory, viewAllCategories, viewCategoryWiseProducts } from "../category.controller.js";


const categoryRoute = express.Router()

//categories api's
categoryRoute.post('/create-category', upload.single('category_image'), createNewCategory)
categoryRoute.get('/view-categories', viewAllCategories)
categoryRoute.get('/view-category-by-id/:editId', GetCategoryById)
categoryRoute.post('/delete-category/:category_id', DeleteCategory)
categoryRoute.post('/update-category', upload.single('category_image'), UpdateCategory)

categoryRoute.get('/view-category-wise-products', viewCategoryWiseProducts)


export default categoryRoute