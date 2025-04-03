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
        return res.status(403).json({
            message: "Authorization header not provided"
        });
    }

    try {
        // Get token from "Bearer <token>"
        const token = authHeader.split(' ')[1]; 
        
        if (!token) {
            return res.status(403).json({
                message: "Token not provided"
            });
        }
        
        if (!process.env.JWT_SECRET) {
            console.error("Missing JWT_SECRET environment variable");
            return res.status(500).json({
                message: "Server configuration error"
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (typeof decoded === "string") {
            return res.status(403).json({
                message: "Invalid token format"
            });
        }

        // Set the userId in the request object
        req.userId = (decoded as JwtPayload).id;
        
        // Debug log to track userId being set correctly
        console.log(`Authenticated user: ${req.userId}`);
        
        next();
    } catch (error) {
        console.error("Authentication error:", error);
        return res.status(403).json({
            message: "Invalid or expired token"
        });
    }
};

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error(err.stack);
    res.status(500).json({ 
        msg: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};