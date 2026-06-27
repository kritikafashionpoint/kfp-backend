import express from "express";
import { addtoCart, addToWishlist, createUser, loginUser, removeFromCart, sendOtp, verifyOtp, viewAllUsers, viewCart, viewWishList } from "../user.controller.js";
import { checkToken } from "../../../middleware/checkToken.js";
import { checkUserAddExists, createOrder, getUserAddressById, outForDelivery, replaceOrder, saveUserAddress, verifyPayment, viewAllOrders, viewOrderByUserId, viewReplacements } from "../../order/order.controller.js";
import upload from "../../../utils/cloudinary_upload.js";

const userRoute = express.Router()

// WEB USER API
userRoute.post('/send-otp', sendOtp)
userRoute.post('/verify-otp', verifyOtp)
userRoute.post('/create-user', createUser)
userRoute.get('/view-users', viewAllUsers)
userRoute.post('/login', loginUser)


// CART API
userRoute.post('/view-cart', checkToken, viewCart)
userRoute.post('/add-to-cart', checkToken, addtoCart)
userRoute.post('/remove-from-cart/:p_id', checkToken, removeFromCart)


// WISHLIST API
userRoute.post('/add-to-wishlist/:id', checkToken, addToWishlist)
userRoute.post('/view-wishlist', checkToken, viewWishList)

// ORDERS API
userRoute.post('/create-order', checkToken, createOrder)
userRoute.post('/verify-order', checkToken, verifyPayment)
userRoute.post('/view-orders', viewAllOrders)
userRoute.post('/view-orders-by-user-id', checkToken, viewOrderByUserId)
userRoute.post('/out-for-delivery', outForDelivery)

userRoute.post('/replace-order', upload.single('image'), checkToken, replaceOrder)

userRoute.post('/view-replacement-requests', viewReplacements)



userRoute.post('/save-address', checkToken, saveUserAddress)

userRoute.post('/get-user-address', checkToken, getUserAddressById)
userRoute.post('/check-address', checkToken, checkUserAddExists)

















export default userRoute