import mongoose from "mongoose";

const contentTypes = ['youtube','twitter','doc','photo','instagram','pinterest','geeksforgeeks','stackoverflow','github','website']

const contentSchema = new mongoose.Schema({
    type : {
        type : String,
        required : true,
        enum : contentTypes
    },
    link : {
        type : String,
        required : true
    },
    title : {
        type : String,
        required : true
    },
    tags : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : "Tag"
    }],
    userId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : "User",
        required : true
    },
    content : String
})

export const Content = mongoose.model("Content", contentSchema);