import express from 'express'
import mongoose from 'mongoose';
import 'dotenv/config'
import { User } from './models/user.model';
import bcrypt, { hash } from 'bcrypt'
import jwt from 'jsonwebtoken'
import { Content } from './models/content.model';
import { userMiddleware } from './middleware';
import { Link } from './models/link.model';
import { random } from './utils';
import cors from "cors"

const app = express()

app.use(express.json());
app.use(cors())

async function connectDB(){
    await mongoose.connect(process.env.MONGO_URL!)
    .then(()=> console.log("db is connected"))
    .catch((e) => console.log("error connecting db : ",e))
}

connectDB();

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

app.post('/api/v1/content',userMiddleware,async(req,res)=>{
    const type = req.body.type;
    const link = req.body.link;
    const title = req.body.title;
    const tags = req.body.tags;
    const content = req.body.content
    const finalcontent = await Content.create({
        title,
        type,
        link,
        tags,
        content,
        userId : req.userId
    })
    if(!finalcontent){
        res.status(500).json({
            msg : "server error "
        })
        return;
    }

    res.status(200).json({
        msg : "content added successfully"
    })
})

app.get('/api/v1/content',userMiddleware,async(req,res)=>{
    const content = await Content.find({ userId: req.userId })

    res.status(200).json({
        content
    })
})

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
    if(share){
        const existingLink = await Link.findOne({
            userId : req.userId
        })

        if(existingLink){
            res.status(200).json({
                hash : existingLink.hash
            })
            return;
        }
        const hash = random(10)
        await Link.create({
            userId : req.userId,
            hash
        })
        res.status(200).json({
            hash
        })
    } else {
        await Link.deleteOne({
            userId : req.userId
        })

        res.status(200).json({
            msg : "removed link"
        })
    }   
})

app.get("/api/v1/brain/:shareLink", async (req, res) => {
    const hash = req.params.shareLink;
        
    const link = await Link.findOne({
        hash
    })
    if(!link){
        res.status(400).json({
            msg : "link is not found"
        })
        return;
    }

    const content = await Content.find({
        userId : link.userId
    })

    const user = await User.findOne({
        _id : link.userId
    })

    if(!user){
        res.status(403).json({
            msg : "user not found"
        })
    }
    const username = user?.username
    res.status(200).json({
        username,
        content
    })
})


app.listen(8080,()=>{
    console.log("app is listening on port 8080");
    
})