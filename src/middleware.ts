import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

declare global {
    namespace Express {
        interface Request {
            userId: string;
        }
    }
}

export const userMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        res.status(403).json({
            message: "Authorization header not provided"
        });
        return;
    }

    try {
        const token = authHeader.split(' ')[1]; // Get token from "Bearer <token>"
        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        
        if (typeof decoded === "string") {
            res.status(403).json({
                message: "Invalid token format"
            });
            return;
        }

        req.userId = (decoded as JwtPayload).id;
        next();
    } catch (error) {
        res.status(403).json({
            message: "Invalid or expired token"
        });
        return;
    }
}