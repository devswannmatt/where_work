const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const MAX_DIMENSION = 2000;
const JPEG_QUALITY = 78;
const UNLINK_RETRY_DELAYS_MS = [40, 120, 250, 500];

function isRetryableWindowsUnlinkError(error) {
  return error && (error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'ENOTEMPTY');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeUnlink(filePath) {
  for (let attempt = 0; attempt <= UNLINK_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await fs.unlink(filePath);
      return;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }

      const hasNextAttempt = attempt < UNLINK_RETRY_DELAYS_MS.length;
      if (hasNextAttempt && isRetryableWindowsUnlinkError(error)) {
        await sleep(UNLINK_RETRY_DELAYS_MS[attempt]);
        continue;
      }

      throw error;
    }
  }
}

async function compressUploadedImages(files = []) {
  const outputPaths = [];

  for (const file of files) {
    const parsedName = path.parse(file.filename);
    const outputFileName = `${parsedName.name}-optimized.jpg`;
    const outputFilePath = path.join(file.destination, outputFileName);

    await sharp(file.path)
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true,
        progressive: true,
      })
      .toFile(outputFilePath);

    if (outputFilePath !== file.path) {
      try {
        await safeUnlink(file.path);
      } catch (_error) {
        // Keep going when cleanup fails; optimized image has already been created.
      }
    }

    outputPaths.push(`/uploads/${outputFileName}`);
  }

  return outputPaths;
}

async function deleteUploadedFiles(files = []) {
  await Promise.all(
    files.map(async (file) => {
      try {
        await safeUnlink(file.path);
      } catch (_error) {
        // Ignore missing files during cleanup.
      }
    })
  );
}

module.exports = {
  compressUploadedImages,
  deleteUploadedFiles,
};