import { HTTP_RESPONSE_CODE } from "../constants/api.response.codes.js";
import { ApiError } from "../utils/api.error.js";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicKey = fs.readFileSync(path.join(__dirname, "../../keys/public.pem"));

export function authMiddleware(req: any, res: any, next: any) {
    //  Get the token from the Authorization header
    const authHeader = req.headers['authorization'];

    //  Extract the token from the "Bearer <token>" string
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "No token provided, authorization denied");
    }

    //  Verify the token
    jwt.verify(token, publicKey, { algorithms: ["RS256"] }, (err: any, decoded: any) => {
        if (err) {
            throw new ApiError(HTTP_RESPONSE_CODE.UNAUTHORIZED, "Invalid token");
        }

        //  Attach user payload to the request object
        req.userId = decoded.user_id;
        req.userName = decoded.user_name;
        req.role = decoded.user_role;
        console.log("userId", req.userId, "Role", req.role)

        next();
    });
}

export default authMiddleware;
