#!/usr/bin/env node
/**
 * Upload images to S3 for CDN serving
 * This removes images from the Lambda bundle and serves them from CloudFront
 */

import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Configuration
const BUCKET_NAME = process.env.AWS_BUCKET_NAME || 'remix-website-writing-posts';
const REGION = process.env.AWS_REGION || 'us-west-2';

// Image directories to upload
const IMAGE_DIRS = [
  join(projectRoot, 'app/images'),
  join(projectRoot, 'public/images'),
];

const s3Client = new S3Client({ region: REGION });

// Determine content type from file extension
function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

// Recursively get all files in a directory
function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    if (statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      // Only upload image files
      const ext = extname(file).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico'].includes(ext)) {
        fileList.push(filePath);
      }
    }
  });

  return fileList;
}

// Upload a single file to S3
async function uploadFile(filePath, baseDir) {
  const relativePath = relative(baseDir, filePath);
  const s3Key = `images/${relativePath}`;

  try {
    const fileContent = readFileSync(filePath);
    const contentType = getContentType(filePath);

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      // Cache for 1 year (immutable assets)
      CacheControl: 'public, max-age=31536000, immutable',
    });

    await s3Client.send(command);
    console.log(`✅ Uploaded: ${s3Key}`);
    return { success: true, key: s3Key };
  } catch (error) {
    console.error(`❌ Failed to upload ${filePath}:`, error.message);
    return { success: false, key: s3Key, error: error.message };
  }
}

// Check if bucket exists and is accessible
async function checkBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    console.log(`✅ Bucket accessible: ${BUCKET_NAME}`);
    return true;
  } catch (error) {
    console.error(`❌ Cannot access bucket ${BUCKET_NAME}:`, error.message);
    console.error('\nMake sure:');
    console.error('1. AWS credentials are configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
    console.error('2. Bucket exists and you have permissions');
    console.error('3. BUCKET_NAME is correct in your .env file\n');
    return false;
  }
}

// Main upload function
async function main() {
  console.log('🚀 Starting image upload to S3...\n');
  console.log(`Bucket: ${BUCKET_NAME}`);
  console.log(`Region: ${REGION}\n`);

  // Check bucket access
  const hasAccess = await checkBucket();
  if (!hasAccess) {
    process.exit(1);
  }

  const results = {
    success: [],
    failed: [],
    totalSize: 0,
  };

  // Upload from each directory
  for (const dir of IMAGE_DIRS) {
    console.log(`\n📂 Processing directory: ${relative(projectRoot, dir)}`);

    try {
      const files = getAllFiles(dir);
      console.log(`Found ${files.length} image files\n`);

      for (const file of files) {
        const stats = statSync(file);
        results.totalSize += stats.size;

        const result = await uploadFile(file, dir);
        if (result.success) {
          results.success.push(result.key);
        } else {
          results.failed.push(result);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing directory ${dir}:`, error.message);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Upload Summary');
  console.log('='.repeat(60));
  console.log(`✅ Successful uploads: ${results.success.length}`);
  console.log(`❌ Failed uploads: ${results.failed.length}`);
  console.log(`📦 Total size uploaded: ${(results.totalSize / 1024 / 1024).toFixed(2)} MB`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed files:');
    results.failed.forEach(f => console.log(`   - ${f.key}: ${f.error}`));
  }

  console.log('\n✨ Done! Images are now available via CloudFront');
  console.log(`🔗 CloudFront URL: https://${BUCKET_NAME}.s3.${REGION}.amazonaws.com/images/`);
  console.log('\n💡 Next steps:');
  console.log('   1. Update .env with CDN_URL');
  console.log('   2. Run: node scripts/update-image-imports.mjs');
  console.log('   3. Test locally to verify images load');
  console.log('   4. Remove app/images directory from source control\n');
}

main().catch(console.error);
