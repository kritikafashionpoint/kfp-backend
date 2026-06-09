import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import cors from 'cors'
import express from 'express'
import indexRouter from './app/ParentRouting/IndexRouter.js'
import bcrypt from "bcrypt";
import pool from './app/config/pgDB.js'
import http from 'http'


const app = express()
app.use(cors())
app.use(express.json())

app.use('/web', indexRouter)

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Kritika Fashion Point Backend is running",
        timestamp: new Date(),
    });
});




const startServer = async () => {
    try {
        await pool.query("SELECT NOW()");
        console.log("PostgreSQL connected ✔");

        // 1️⃣ Create table
        await pool.query(`

      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


  CREATE TABLE IF NOT EXISTS admin_user (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_email VARCHAR(150) UNIQUE NOT NULL,
    admin_password VARCHAR(255) NOT NULL,
    otp BIGINT CHECK (otp >= 100000 AND otp <= 999999),
    otp_expire BIGINT CHECK (otp_expire > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

        // 2️⃣ Check admin exist
        const adminCheck = await pool.query(
            "SELECT * FROM admin_user WHERE admin_email=$1",
            ["tarunmehra80790@gmail.com"]
        );

        if (adminCheck.rows.length === 0) {

            // bcrypt hash
            const hashedPassword = await bcrypt.hash("Tarun123", 10);

            await pool.query(
                "INSERT INTO admin_user (admin_email, admin_password) VALUES ($1,$2)",
                ["tarunmehra80790@gmail.com", hashedPassword]
            );

            console.log("Default admin created ✔");
        }

        console.log("Admin table verified ✔");

        const server = http.createServer(app);

        server.listen(process.env.PORT, () => {
            console.log(`Server running on PORT : ${process.env.PORT}`);
        });

    } catch (error) {
        console.error("DB connection failed", error.message);
        process.exit(1);
    }
};

startServer();

export default app;