import express from "express";
import { addtoCart, addToWishlist, createUser, loginUser, removeFromCart, sendOtp, verifyOtp, viewAllUsers, viewCart, viewWishList } from "../user.controller.js";
import { checkToken } from "../../../middleware/checkToken.js";

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









export default userRoute