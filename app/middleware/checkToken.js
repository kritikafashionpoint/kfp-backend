import jwt from "jsonwebtoken";

export const checkToken = async (req, res, next) => {
    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                status: false,
                message: "Authorization token is required",
            });
        }

        const token = authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : authHeader;

        if (!token) {
            return res.status(401).json({
                status: false,
                message: "Invalid token format",
            });
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;
        console.log(req.user)

        next();

    } catch (error) {

        console.error("Token Verification Error:", error);

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                status: false,
                message: "Token expired. Please login again.",
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                status: false,
                message: "Invalid token",
            });
        }

        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
        });
    }
};