// js/download-helper.js

/**
 * Downloads a file from a URL as binary data without corruption.
 * @param {string} fileUrl - The URL of the file to download
 * @param {string} originalFileName - The fallback filename to save as
 */
export async function downloadFile(fileUrl, originalFileName) {
  if (!fileUrl) {
    console.error("No file URL provided for download.");
    return;
  }

  // Show a basic loading toast/alert if UI allows (assuming toast.js is loaded, though we keep it independent here)
  if (window.Toast) {
    window.Toast.show("Downloading file...", "info");
  }

  try {
    const response = await fetch(fileUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    
    // Try to guess extension from URL if originalFileName lacks one
    let finalFileName = originalFileName;
    if (fileUrl.includes('.pdf') && !finalFileName.toLowerCase().endsWith('.pdf')) {
      finalFileName += '.pdf';
    } else if (blob.type === 'application/pdf' && !finalFileName.toLowerCase().endsWith('.pdf')) {
      finalFileName += '.pdf';
    }

    a.download = finalFileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    
    URL.revokeObjectURL(url);
    
    if (window.Toast) {
      window.Toast.show("Download complete!", "success");
    }
  } catch (error) {
    console.error("Download error:", error);
    if (window.Toast) {
      window.Toast.show("Failed to download file. Please check your connection.", "error");
    } else {
      alert("Failed to download file.");
    }
  }
}
