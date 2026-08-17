import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

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
  // 6h window so large uploads (multi-GB final cuts) never time out mid-transfer
  // on a slow connection. Each key is unique, so a long-lived PUT target is safe.
  const url = await getSignedUrl(R2, command, { expiresIn: 21600 });
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

// Fetch an object's raw bytes as a Buffer (server-side). Used to pull an
// uploaded HEIC back out of R2 so we can convert it to JPEG. transformToByteArray
// is provided by the AWS SDK v3 stream mixin in Node.
export async function getObjectBuffer(key) {
  const res = await R2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

// Rotate a stored image `angle` degrees clockwise (90/180/270), OVERWRITING the
// same R2 key so every reference (portal, sheet, montage) picks up the new
// orientation. EXIF orientation is baked into pixels first so the rotation is
// visually predictable; the image format is preserved.
export async function rotateStoredImage(key, contentType, angle = 90) {
  const a = ((Math.trunc(Number(angle) || 90) % 360) + 360) % 360;
  const buf = await getObjectBuffer(key);
  const oriented = await sharp(buf).rotate().toBuffer(); // apply/clear EXIF orientation
  const out = await sharp(oriented).rotate(a).toBuffer(); // preserves input format
  await putFile(key, out, contentType || 'image/jpeg');
}

// Presigned URL that forces a DOWNLOAD (Content-Disposition: attachment) with a
// chosen filename, instead of displaying inline. Used by the admin editor's
// one-touch Download so clicking it saves the file straight away rather than
// opening the image in a browser tab. Same-bucket presign, so no CORS needed.
export async function getDownloadUrl(key, filename, expiresIn = 3600) {
  const safe = String(filename || 'photo').replace(/["\\\r\n]/g, '_');
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${safe}"`,
  });
  return getSignedUrl(R2, command, { expiresIn });
}
