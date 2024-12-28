"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Content = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const contentTypes = ['youtube', 'twitter', 'doc', 'photo'];
const contentSchema = new mongoose_1.default.Schema({
    type: {
        type: String,
        required: true,
        enum: contentTypes
    },
    link: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    tags: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: "Tag"
        }],
    userId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    content: String
});
exports.Content = mongoose_1.default.model("Content", contentSchema);
