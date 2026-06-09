import pool from "../../config/pgDB.js";

export const SaveContactService = async (req) => {
    try {

        const { name, phone, message } = req.body;

        if (!name || !phone || !message) {
            return {
                status: false,
                message: "All fields are required",
            };
        }

        const query = `
            INSERT INTO contact_messages
            (
                name,
                phone,
                message,
                created_at
            )
            VALUES
            (
                $1,
                $2,
                $3,
                NOW()
            )
            RETURNING *
        `;

        const result = await pool.query(query, [
            name,
            phone,
            message,
        ]);

        return {
            status: true,
            message: "Message submitted successfully",
            data: result.rows[0],
        };

    } catch (error) {
        console.log("SaveContactService Error:", error);

        return {
            status: false,
            message: "Internal Server Error",
        };
    }
};

export const ViewContactService = async () => {
    try {

        const query = `
            SELECT *
            FROM contact_messages
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query);

        return {
            status: true,
            message: "Contacts fetched successfully",
            data: result.rows,
        };

    } catch (error) {
        console.log("ViewContactService Error:", error);

        return {
            status: false,
            message: "Internal Server Error",
        };
    }
};