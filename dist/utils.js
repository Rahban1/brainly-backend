"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.random = random;
function random(len) {
    const str = "qwertyuiopasdfghjklzxcvbnm1231456789";
    let ans = "";
    for (let i = 0; i < len; i++) {
        ans += str[Math.floor(Math.random() * str.length)];
    }
    return ans;
}
