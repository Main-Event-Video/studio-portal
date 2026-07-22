import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// Copied from MEvid's lib/r2.js — same shared bucket + creds.
// Only change: key prefix is studio/{clientId}/… per the handoff.
const R2 = new S3Client({
  region: 'auto',
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET;

// Presigned URL for direct browser → R2 upload (big files never touch Vercel).
export async function getUploadUrl(clientId, fileType) {
  const ext = (fileType && fileType.split('/')[1]) || 'bin';
  const key = `studio/${clientId}/${uuidv4()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: fileType });
  const url = await getSignedUrl(R2, command, { expiresIn: 3600 });
  return { url, key };
}

// Presigned URL for viewing a private file.
export async function getViewUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(R2, command, { expiresIn });
}

export function getPublicUrl(key) {
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
}

export async function deleteFile(key) {
  await R2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// Server-side upload (webhook copies finished renders into our bucket so we
// don't depend on Creatomate's 30-day temporary hosting).
export async function putFile(key, body, contentType) {
  await R2.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}
