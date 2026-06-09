import express from 'express'
import upload from '../../../utils/cloudinary_upload.js'
import categoryRoute from '../../category/routes/categoryRoute.js'
import productRoute from '../../product/routes/productRoute.js'
import adminAuthRoute from '../../admin_auth/routes/admin_authRoute.js'
const adminRoute = express.Router()

adminRoute.use('/auth', adminAuthRoute)
adminRoute.use('/category', categoryRoute)
adminRoute.use('/product', productRoute)







export default adminRoute