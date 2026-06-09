import express from "express";
import { checkToken } from "../../../middleware/checkToken.js";

import {
    createOrder,
    checkPaymentStatus,
    phonePeWebhook
} from "../payment.controller.js";

const paymentRoute = express.Router();

paymentRoute.post(
    "/create-order",
    checkToken,
    createOrder
);

paymentRoute.get(
    "/status/:transactionId",
    checkPaymentStatus
);

paymentRoute.post(
    "/phonepe/webhook",
    phonePeWebhook
);

export default paymentRoute;