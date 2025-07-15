import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";
const SALT_ROUNDS = 10;

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId: number, username: string): string {
  return jwt.sign(
    { userId, username },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function verifyToken(token: string): { userId: number; username: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; username: string };
  } catch (error) {
    return null;
  }
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }

  const user = await storage.getUser(payload.userId);
  if (!user) {
    return res.status(403).json({ message: "User not found" });
  }

  req.user = {
    id: user.id,
    username: user.username
  };
  next();
}

export async function registerUser(username: string, password: string) {
  const existingUser = await storage.getUserByUsername(username);
  if (existingUser) {
    throw new Error("Username already exists");
  }

  const hashedPassword = await hashPassword(password);
  const user = await storage.createUser({
    username,
    password: hashedPassword
  });

  return {
    id: user.id,
    username: user.username,
    token: generateToken(user.id, user.username)
  };
}

export async function loginUser(username: string, password: string) {
  const user = await storage.getUserByUsername(username);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isValidPassword = await comparePassword(password, user.password);
  if (!isValidPassword) {
    throw new Error("Invalid credentials");
  }

  return {
    id: user.id,
    username: user.username,
    token: generateToken(user.id, user.username)
  };
} 