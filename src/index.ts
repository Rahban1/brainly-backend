import express from 'express'
import mongoose from 'mongoose';
import 'dotenv/config'
import https from 'https';
import http from 'http';
import fs from 'fs';
import { User } from './models/user.model';
import bcrypt, { hash } from 'bcrypt'
import jwt from 'jsonwebtoken'
import { Content } from './models/content.model';
import { userMiddleware } from './middleware';
import { Link } from './models/link.model';
import { random } from './utils';
import cors from "cors"
import 'express-async-errors';
import { errorHandler } from './middleware';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const app = express()

app.use(express.json());
app.use(cors());

app.options('*', cors());

app.use(express.static(path.join(__dirname, '../dist')));

if (!process.env.JWT_SECRET || !process.env.MONGO_URL) {
    console.error('Missing required environment variables');
    process.exit(1);
}

console.log(process.env.MONGO_URL)
// Replace your existing server start logic in connectDB with this:
async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGO_URL!);
        console.log("DB is connected");
        
        // Create HTTP server
        const httpServer = http.createServer(app);
        
        // Start HTTP server
        httpServer.listen(3000, '0.0.0.0', () => {
            console.log("HTTP server is listening on port 80");
            console.log("ci/cd is running")
        });

        try {
            // SSL certificate configuration
            const options = {
                key: fs.readFileSync('/etc/letsencrypt/live/api.recollectify.me/privkey.pem'),
                cert: fs.readFileSync('/etc/letsencrypt/live/api.recollectify.me/cert.pem')
            };

            // Create HTTPS server
            const httpsServer = https.createServer(options, app);
            
            // Start HTTPS server
            httpsServer.listen(443, '0.0.0.0', () => {
                console.log("HTTPS server is listening on port 443");
            });
        } catch (error) {
            console.error("Error setting up HTTPS server:", error);
            console.log("Continuing with HTTP only")
        }
    } catch (e) {
        console.error("Error connecting to DB:", e);
        process.exit(1);
    }
}
connectDB().then(() => {
         verifyContentAssociations();
     });
app.get('/',(req,res)=>{
    res.send("the backend is working and up and ci/cd is working")
    
})

app.post('/api/v1/user/signup',async (req,res)=>{
    const {username , password} = req.body;

    //zod validation 

    const prevUser = await User.findOne({
        username
    })
    if(prevUser){
        res.status(403).json({
            msg : "username already exists"
        })
        return;
    }

    const user = await User.create({
        username,
        password
    })

    if(!user){
        res.status(500).json({
            msg : "server error"
        })
        return;
    }
    res.status(200).json({
        msg : "user signed up successfully"
    })
})

app.post('/api/v1/user/signin',async (req,res)=>{
    const {username, password} = req.body;

    //zod validation

    const user = await User.findOne({
        username
    })

    if(!user){
        res.status(403).json({
            msg : "user not found"
        })
        return;
    }

    const validPassword = await bcrypt.compare(password,user.password);

    if(!validPassword){
        res.status(403).json({
            msg : "invalid credentials"
        })
        return;
    }

    const token = jwt.sign({
        id : user._id
    },process.env.JWT_SECRET!);

    if(!token){
        res.status(500).json({
            msg : "server error"
        })
        return;
    }

    res.status(200).json({
        token
    })
})

app.post('/api/v1/content', userMiddleware, async (req, res) => {
    try {
        const { type, link, title, tags, content } = req.body;
        
        // Ensure userId is properly formatted as ObjectId
        const userId = new mongoose.Types.ObjectId(req.userId);
        
        console.log(`Creating content for user: ${userId}`);
        
        const finalcontent = await Content.create({
            title,
            type,
            link,
            tags,
            content,
            userId
        });
        
        res.status(200).json({
            msg: "content added successfully"
        });
    } catch (error) {
        console.error("Error creating content:", error);
        res.status(500).json({
            msg: "server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Add this function to your index.ts file
async function verifyContentAssociations() {
    try {
        // Find all content without a valid userId
        const orphanedContent = await Content.find({
            $or: [
                { userId: null },
                { userId: { $exists: false } }
            ]
        });
        
        console.log(`Found ${orphanedContent.length} content items without a valid userId`);
        
        // Find all users and their content
        const users = await User.find({});
        console.log(`Found ${users.length} users in the database`);
        
        for (const user of users) {
            const userContent = await Content.find({ userId: user._id });
            console.log(`User ${user.username} (${user._id}) has ${userContent.length} content items`);
        }
        
        // Find any potential string vs ObjectId mismatches
        const allContent = await Content.find({});
        const potentialMismatches = allContent.filter(item => 
            typeof item.userId === 'string' || 
            !(item.userId instanceof mongoose.Types.ObjectId)
        );
        
        console.log(`Found ${potentialMismatches.length} content items with potential userId type mismatches`);
        
        return {
            orphanedContent,
            potentialMismatches
        };
    } catch (error) {
        console.error("Database verification error:", error);
        return null;
    }
}

// Call this once during startup to verify the database integrity
// connectDB().then(() => {
//     verifyContentAssociations();
// });

app.get('/api/v1/content', userMiddleware, async (req, res) => {
    try {
        // Ensure userId is properly formatted as ObjectId
        const userId = new mongoose.Types.ObjectId(req.userId);
        
        console.log(`Fetching content for user: ${userId}`);
        
        const content = await Content.find({ userId });
        
        console.log(`Found ${content.length} content items for user ${userId}`);
        
        res.status(200).json({
            content
        });
    } catch (error) {
        console.error("Error fetching content:", error);
        res.status(500).json({
            msg: "Error fetching content",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

app.delete("/api/v1/content", userMiddleware, async (req, res) => {
    const { title } = req.body;

    const result = await Content.deleteMany({ title, userId: req.userId });

    if (result.deletedCount === 0) {
        res.status(404).json({
            msg: "no content found with the specified title"
        });
        return;
    }

    res.status(200).json({
        msg: "content deleted successfully"
    });
    return;
});

app.post("/api/v1/brain/share", userMiddleware, async (req, res) => {
    const share = req.body.share;
    console.log("Share request for userId:", req.userId);
    
    if(share){
        const existingLink = await Link.findOne({
            userId : req.userId
        })

        if(existingLink){
            console.log("Found existing link:", existingLink);
            res.status(200).json({
                hash : existingLink.hash
            })
            return;
        }
        const hash = random(10)
        console.log("Creating new link with hash:", hash, "for userId:", req.userId);
        
        const newLink = await Link.create({
            userId : req.userId,
            hash
        })
        console.log("Created new link:", newLink);
        
        res.status(200).json({
            hash
        })
    } else {
        console.log("Removing link for userId:", req.userId);
        const result = await Link.deleteOne({
            userId : req.userId
        })
        console.log("Delete result:", result);

        res.status(200).json({
            msg : "removed link"
        })
    }   
})

app.get("/api/v1/brain/:shareLink", async (req, res) => {
    const hash = req.params.shareLink;
    console.log("Looking for share link with hash:", hash);
        
    const link = await Link.findOne({
        hash
    })
    console.log("Found link:", link);
    
    if(!link){
        res.status(400).json({
            msg : "link is not found"
        })
        return;
    }

    console.log("Fetching content for userId:", link.userId);
    const content = await Content.find({
        userId : link.userId
    })
    console.log("Found content items:", content.length);

    const user = await User.findOne({
        _id : link.userId
    })

    if(!user){
        res.status(403).json({
            msg : "user not found"
        })
        return;
    }
    const username = user?.username
    res.status(200).json({
        username,
        content
    })
})

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Add error handling middleware at the end
app.use(errorHandler);

// Add global error listeners
process.on('unhandledRejection', (reason: Error | any) => {
    console.error('Unhandled Rejection at:', reason.stack || reason);
});

process.on('uncaughtException', (error: Error) => {
    console.error('Uncaught Exception:', error);
    // Optional: restart the process here if needed
});