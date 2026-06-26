#!/usr/bin/env node
import { mkdirSync } from "fs";
import { join } from "path";

console.log("🔧 Setting up upload directories...");

try {
  mkdirSync(join(process.cwd(), "uploads"), { recursive: true });
  mkdirSync(join(process.cwd(), "uploads", "videos"), { recursive: true });
  mkdirSync(join(process.cwd(), "uploads", "images"), { recursive: true });
  mkdirSync(join(process.cwd(), "uploads", "documents"), { recursive: true });
  console.log("✅ Upload directories created successfully");
  process.exit(0);
} catch (error) {
  console.error("❌ Failed to create upload directories:", error);
  process.exit(1);
}
