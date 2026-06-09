import { SaveContactService, ViewContactService } from "./contact_service.js";

export const saveContact = async (req, res) => {
    try {
        const result = await SaveContactService(req);

        if (!result.status) {
            return res.status(400).json({
                status: false,
                message: result.message,
            });
        }

        return res.status(201).json({
            status: true,
            message: result.message,
            data: result.data,
        });

    } catch (error) {
        console.error("saveContact Controller Error:", error);

        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};


export const viewContact = async (req, res) => {
    try {
        const result = await ViewContactService();

        if (!result.status) {
            return res.status(400).json({
                status: false,
                message: result.message,
            });
        }

        return res.status(200).json({
            status: true,
            message: result.message,
            data: result.data,
        });

    } catch (error) {
        console.error("viewContact Controller Error:", error);

        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
};