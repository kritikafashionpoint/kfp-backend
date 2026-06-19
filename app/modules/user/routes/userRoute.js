import express from "express";
import { addtoCart, addToWishlist, createUser, loginUser, removeFromCart, sendOtp, verifyOtp, viewAllUsers, viewCart, viewWishList } from "../user.controller.js";
import { checkToken } from "../../../middleware/checkToken.js";
import { createOrder, verifyPayment, viewAllOrders } from "../../order/order.controller.js";

const userRoute = express.Router()

userRoute.post('/send-otp', sendOtp)
userRoute.post('/verify-otp', verifyOtp)
userRoute.post('/create-user', createUser)
userRoute.get('/view-users', viewAllUsers)
userRoute.post('/login', loginUser)

userRoute.post('/add-to-cart', checkToken, addtoCart)

userRoute.post('/view-cart', checkToken, viewCart)
userRoute.post('/remove-from-cart/:p_id', checkToken, removeFromCart)

userRoute.post('/add-to-wishlist/:id', checkToken, addToWishlist)
userRoute.post('/view-wishlist', checkToken, viewWishList)

userRoute.post('/create-order', checkToken, createOrder)
userRoute.post('/verify-order', checkToken, verifyPayment)

userRoute.post('/view-orders', viewAllOrders)














export default userRoute