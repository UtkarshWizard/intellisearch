import type { NextFunction, Request, Response } from "express";
import { createSupabaseClient } from "../client";
import { prisma } from "../db";
import "../express.d.ts";

const client = createSupabaseClient();

export async function authMiddleware (req: Request , res: Response , next: NextFunction) {
    const token = req.headers.authorization;

    const data = await client.auth.getUser(token);

    const userId = data.data.user?.id;

    if (userId) {

        try {
            await prisma.user.create({
                data: {
                    id: data.data.user?.id!,
                    email: data.data.user?.email!,
                    provider: data.data.user?.app_metadata.provider === "google" ? "GOOGLE" : "GITHUB",
                    name: data.data.user?.user_metadata.name!,
                    supabaseId: data.data.user?.id!,
                }
            })
        } catch (e) {
            if (!(e instanceof Error && e.message.includes('duplicate key'))) {
                console.error('Error creating user:', e);
            }
        }

        req.userId = userId;
        next();
    } else {
        return res.status(401).json({error: "Unauthorized"});
    }
}