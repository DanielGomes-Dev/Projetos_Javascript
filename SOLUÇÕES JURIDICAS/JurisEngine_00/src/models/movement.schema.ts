import { Schema } from "mongoose";

export const movementSchema = new Schema(
    {
        description: {
            type: String,
            required: true
        },
        date: {
            type: Date,
            required: true,
        }
    }
);




