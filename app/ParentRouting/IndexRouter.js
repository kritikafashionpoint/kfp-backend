import e from "express";
import adminRoute from "../modules/admin/routes/adminRoute.js";
import categoryRoute from "../modules/category/routes/categoryRoute.js";
import contactRoute from "../modules/contact_or_enquires/routes/contactRoute.js";
import userRoute from "../modules/user/routes/userRoute.js";

const indexRouter = e.Router()
indexRouter.use('/admin', adminRoute)
indexRouter.use('/category', categoryRoute)
indexRouter.use('/contact', contactRoute)
indexRouter.use('/user', userRoute)


export default indexRouter