// js/cloudinary-config.js

// Replace these with your actual Cloudinary credentials
// You must enable "Unsigned Uploading" in your Cloudinary Settings -> Upload -> Upload presets
export const CLOUDINARY_CLOUD_NAME = 'YOUR_CLOUD_NAME_HERE';
export const CLOUDINARY_UPLOAD_PRESET = 'YOUR_UNSIGNED_PRESET_HERE';

/**
 * Uploads a file directly to Cloudinary using their REST API
 * @param {File} file - The file object from an <input type="file">
 * @param {Function} onProgress - Optional callback for upload progress (0-100)
 * @returns {Promise<string>} - The secure URL of the uploaded file
 */
export async function uploadToCloudinary(file, onProgress = null) {
  if (!file) return null;

  if (CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME_HERE') {
    console.warn('Cloudinary is not configured. Returning local object URL for preview only.');
    // Fallback for development if not configured, this won't persist across devices
    return URL.createObjectURL(file);
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(Math.round(percentComplete));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        resolve(response.secure_url);
      } else {
        reject(new Error(`Upload failed: ${xhr.statusText}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error occurred during upload.'));
    xhr.send(formData);
  });
}
