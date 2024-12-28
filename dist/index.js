"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
require("dotenv/config");
const user_model_1 = require("./models/user.model");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const content_model_1 = require("./models/content.model");
const middleware_1 = require("./middleware");
const link_model_1 = require("./models/link.model");
const utils_1 = require("./utils");
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)());
function connectDB() {
    return __awaiter(this, void 0, void 0, function* () {
        yield mongoose_1.default.connect(process.env.MONGO_URL)
            .then(() => console.log("db is connected"))
            .catch((e) => console.log("error connecting db : ", e));
    });
}
connectDB();
app.post('/api/v1/user/signup', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    //zod validation 
    const prevUser = yield user_model_1.User.findOne({
        username
    });
    if (prevUser) {
        res.status(403).json({
            msg: "username already exists"
        });
        return;
    }
    const user = yield user_model_1.User.create({
        username,
        password
    });
    if (!user) {
        res.status(500).json({
            msg: "server error"
        });
        return;
    }
    res.status(200).json({
        msg: "user signed up successfully"
    });
}));
app.post('/api/v1/user/signin', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, password } = req.body;
    //zod validation
    const user = yield user_model_1.User.findOne({
        username
    });
    if (!user) {
        res.status(403).json({
            msg: "user not found"
        });
        return;
    }
    const validPassword = yield bcrypt_1.default.compare(password, user.password);
    if (!validPassword) {
        res.status(403).json({
            msg: "invalid credentials"
        });
        return;
    }
    const token = jsonwebtoken_1.default.sign({
        id: user._id
    }, process.env.JWT_SECRET);
    if (!token) {
        res.status(500).json({
            msg: "server error"
        });
        return;
    }
    res.status(200).json({
        token
    });
}));
app.post('/api/v1/content', middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const type = req.body.type;
    const link = req.body.link;
    const title = req.body.title;
    const tags = req.body.tags;
    const content = req.body.content;
    const finalcontent = yield content_model_1.Content.create({
        title,
        type,
        link,
        tags,
        content,
        userId: req.userId
    });
    if (!finalcontent) {
        res.status(500).json({
            msg: "server error "
        });
        return;
    }
    res.status(200).json({
        msg: "content added successfully"
    });
}));
app.get('/api/v1/content', middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const content = yield content_model_1.Content.find({ userId: req.userId });
    res.status(200).json({
        content
    });
}));
app.delete("/api/v1/content", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { title } = req.body;
    const result = yield content_model_1.Content.deleteMany({ title, userId: req.userId });
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
}));
app.post("/api/v1/brain/share", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const share = req.body.share;
    if (share) {
        const existingLink = yield link_model_1.Link.findOne({
            userId: req.userId
        });
        if (existingLink) {
            res.status(200).json({
                hash: existingLink.hash
            });
            return;
        }
        const hash = (0, utils_1.random)(10);
        yield link_model_1.Link.create({
            userId: req.userId,
            hash
        });
        res.status(200).json({
            hash
        });
    }
    else {
        yield link_model_1.Link.deleteOne({
            userId: req.userId
        });
        res.status(200).json({
            msg: "removed link"
        });
    }
}));
app.get("/api/v1/brain/:shareLink", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const hash = req.params.shareLink;
    const link = yield link_model_1.Link.findOne({
        hash
    });
    if (!link) {
        res.status(400).json({
            msg: "link is not found"
        });
        return;
    }
    const content = yield content_model_1.Content.find({
        userId: link.userId
    });
    const user = yield user_model_1.User.findOne({
        _id: link.userId
    });
    if (!user) {
        res.status(403).json({
            msg: "user not found"
        });
    }
    const username = user === null || user === void 0 ? void 0 : user.username;
    res.status(200).json({
        username,
        content
    });
}));
app.listen(8080, () => {
    console.log("app is listening on port 8080");
});
