import express from "express";
import { saveContact, viewContact } from "../contact_controller.js";

const contactRoute = express.Router()

contactRoute.post('/save-contact', saveContact)
contactRoute.get('/view-contact', viewContact)


export default contactRoute