// WebView / Website 2 APK Builder & Browser Safe File Download Helper

export function isAndroidOrWebView(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isWebView = /; wv\)/i.test(ua) || /\bwv\b/i.test(ua);
  const isFileProtocol = window.location.protocol === 'file:';
  return isAndroid || isWebView || isFileProtocol;
}

function triggerAnchorDownload(href: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader result is not a string'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Safely downloads a Blob across desktop browsers, mobile browsers, and Android WebView (Website 2 APK Builder).
 * Android WebView DownloadManager often fails on `blob:` URLs, so on Android/WebView/`file:` contexts
 * blobs up to 20 MB are converted to `data:` URLs before triggering the download anchor.
 */
export async function downloadBlobSafe(blob: Blob, fileName: string): Promise<void> {
  const maxDataUrlSize = 20 * 1024 * 1024; // 20 MB

  if (isAndroidOrWebView() && blob.size <= maxDataUrlSize) {
    try {
      const dataUrl = await blobToDataUrl(blob);
      triggerAnchorDownload(dataUrl, fileName);
      return;
    } catch {
      // Fall through to share or blob URL fallback
    }
  }

  // For oversized blobs on WebView where data URL isn't ideal, try Web Share API if available
  if (isAndroidOrWebView() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (!nav.canShare || nav.canShare({ files: [file] })) {
        await navigator.share({ title: fileName, files: [file] });
        return;
      }
    } catch {
      // User cancelled or unsupported — fall back to blob URL below
    }
  }

  const url = URL.createObjectURL(blob);
  triggerAnchorDownload(url, fileName);
  window.setTimeout(() => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, 10000);
}
