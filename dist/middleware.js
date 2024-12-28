"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const userMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(403).json({
            message: "Authorization header not provided"
        });
        return;
    }
    try {
        const token = authHeader.split(' ')[1]; // Get token from "Bearer <token>"
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (typeof decoded === "string") {
            res.status(403).json({
                message: "Invalid token format"
            });
            return;
        }
        req.userId = decoded.id;
        next();
    }
    catch (error) {
        res.status(403).json({
            message: "Invalid or expired token"
        });
        return;
    }
};
exports.userMiddleware = userMiddleware;
