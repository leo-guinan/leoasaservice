import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import multer from "multer";
import multerS3 from "multer-s3";
import { v4 as uuidv4 } from "uuid";
import type { Request } from "express";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.APP_AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.APP_AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.APP_AWS_S3_BUCKET || "research-buddy-uploads";

// Configure multer for S3 uploads
export const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: BUCKET_NAME,
    metadata: function (req: Request, file: Express.Multer.File, cb: (error: any, metadata?: any) => void) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req: Request, file: Express.Multer.File, cb: (error: any, key?: string) => void) {
      const userId = (req as any).user?.id || "anonymous";
      const fileId = uuidv4();
      const extension = file.originalname.split('.').pop();
      cb(null, `uploads/${userId}/${fileId}.${extension}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Only allow PDF files
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

// Generate presigned URL for file access
export async function generatePresignedUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
}

// Upload file directly to S3
export async function uploadFileToS3(
  fileBuffer: Buffer,
  fileName: string,
  userId: number
): Promise<{ key: string; url: string }> {
  const fileId = uuidv4();
  const extension = fileName.split('.').pop();
  const key = `uploads/${userId}/${fileId}.${extension}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: "application/pdf",
    Metadata: {
      originalName: fileName,
      uploadedBy: userId.toString(),
    },
  });
  
  await s3Client.send(command);
  
  // Generate presigned URL
  const url = await generatePresignedUrl(key);
  
  return { key, url };
}

// Check if S3 is configured
export function isS3Configured(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID && 
           process.env.AWS_SECRET_ACCESS_KEY && 
           process.env.AWS_S3_BUCKET);
} 