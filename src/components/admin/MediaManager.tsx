"use client";

import { useState } from "react";
import { Loader2, UploadCloud, AlertCircle, Check, XCircle, Film } from "lucide-react";
import { getApiBase } from "@/utils/apiBase";

export interface MediaItem {
  uri: string;
  type: string;
}

// Kept in sync with the backend's per-type ceilings (IMAGE_MAX_BYTES /
// VIDEO_MAX_BYTES). Pre-checking here gives instant feedback and avoids
// pushing an oversize file over the wire only to be rejected.
const IMAGE_MAX_BYTES = 15 * 1024 * 1024;
const VIDEO_MAX_BYTES = 300 * 1024 * 1024;
// Derived so the limits shown to the admin can never drift from the numbers
// actually enforced above.
const IMAGE_MAX_MB = IMAGE_MAX_BYTES / 1024 / 1024;
const VIDEO_MAX_MB = VIDEO_MAX_BYTES / 1024 / 1024;
const UPLOAD_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm";

// Some browsers hand us a File with an empty `type` (notably .mov). The
// presigned PUT must be signed with — and uploaded with — the same
// Content-Type, so derive one from the extension when the browser omits it.
const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

function resolveContentType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "";
}

// PUT the file straight to R2 via the presigned URL, reporting upload progress.
// fetch() can't surface upload progress, so we use XMLHttpRequest.
function putToR2(
  url: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`R2 ${xhr.status}`));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(file);
  });
}

// Shared upload + cover-picker + delete grid used by both the new-post and
// edit-post admin screens. Uploads land in the backend's tmp prefix and are
// promoted to permanent storage when the post is created/saved (claimTmpMedia).
export default function MediaManager({
  media,
  onMediaChange,
  coverImage,
  onCoverChange,
  getToken,
  onAuthFail,
}: {
  media: MediaItem[];
  onMediaChange: (m: MediaItem[]) => void;
  coverImage: string;
  onCoverChange: (uri: string) => void;
  getToken: () => string | null;
  onAuthFail: () => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const token = getToken();
    if (!token) {
      onAuthFail();
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError("");
    const apiUrl = getApiBase();
    try {
      const uploaded: MediaItem[] = [];
      const rejected: string[] = [];
      for (const file of Array.from(files)) {
        const contentType = resolveContentType(file);
        const isVideo = contentType.startsWith("video/");
        if (!contentType) {
          rejected.push(`${file.name}（不支援的檔案格式）`);
          continue;
        }
        const max = isVideo ? VIDEO_MAX_BYTES : IMAGE_MAX_BYTES;
        if (file.size > max) {
          rejected.push(`${file.name}（${isVideo ? `影片上限 ${VIDEO_MAX_MB}MB` : `圖片上限 ${IMAGE_MAX_MB}MB`}）`);
          continue;
        }
        // 1) Ask the backend for a presigned PUT URL (bypasses Cloud Run 32MB).
        const res = await fetch(`${apiUrl}/api/v1/posts/upload-url`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ contentType }),
        });
        if (res.status === 401) {
          setUploadError("登入已過期，請重新登入。");
          onAuthFail();
          return;
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          rejected.push(`${file.name}（${err.message || "無法取得上傳連結"}）`);
          continue;
        }
        const { uploadUrl, publicUrl, type }: {
          uploadUrl: string;
          publicUrl: string;
          type: "photo" | "video";
        } = await res.json();
        // 2) Upload the file straight to R2 with progress.
        setUploadProgress(0);
        try {
          await putToR2(uploadUrl, file, contentType, setUploadProgress);
          uploaded.push({ uri: publicUrl, type });
        } catch {
          rejected.push(`${file.name}（上傳失敗）`);
        }
      }
      if (uploaded.length > 0) {
        onMediaChange([...media, ...uploaded]);
        // Auto-select the first uploaded *image* as cover if none set yet
        // (videos can't be covers).
        const firstPhoto = uploaded.find((m) => m.type === "photo");
        if (firstPhoto && !coverImage) onCoverChange(firstPhoto.uri);
      }
      if (rejected.length > 0) setUploadError(`部分檔案未上傳：${rejected.join("、")}`);
    } catch {
      setUploadError("連線失敗，請檢查網路狀態。");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeMedia = (uri: string) => {
    onMediaChange(media.filter((m) => m.uri !== uri));
    if (coverImage === uri) onCoverChange("");
  };

  return (
    <div className="bg-white p-6 border border-line shadow-sm space-y-5">
      <label
        className={`flex items-center justify-center gap-3 w-full py-6 border-2 border-dashed transition-colors cursor-pointer ${isUploading ? "border-brand/40 text-ink/30" : "border-line text-ink/50 hover:border-brand hover:text-brand"}`}
      >
        {isUploading ? <Loader2 className="animate-spin" size={22} /> : <UploadCloud size={22} />}
        <span className="font-sans text-base font-bold">
          {isUploading
            ? `上傳中… ${uploadProgress}%`
            : "點此上傳圖片或影片（可多選）"}
        </span>
        <input
          type="file"
          accept={UPLOAD_ACCEPT}
          multiple
          disabled={isUploading}
          onChange={(e) => {
            handleUpload(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
      </label>
      <p className="font-sans text-xs text-ink/30">
        圖片每張最大 {IMAGE_MAX_MB}MB；影片每支最大 {VIDEO_MAX_MB}MB。影片不可設為封面。
      </p>
      {uploadError && (
        <p className="text-brand text-sm font-sans font-bold flex items-start gap-1">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          {uploadError}
        </p>
      )}

      {media.length > 0 ? (
        <>
          <p className="font-sans text-xs font-black text-ink/40 uppercase tracking-widest">
            點選圖片設為封面
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {media.map((m, idx) => (
              <div key={idx} className="relative group">
                {m.type === "video" ? (
                  <div className="relative aspect-square border-2 border-line overflow-hidden rounded-md w-full bg-ink/5">
                    <video src={m.uri} className="w-full h-full object-cover" muted preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Film size={22} className="text-white drop-shadow" />
                    </div>
                    <span className="absolute bottom-1 left-1 bg-ink/70 text-white font-sans text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
                      影片
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCoverChange(m.uri)}
                    className={`relative aspect-square border-2 transition-all overflow-hidden rounded-md w-full ${coverImage === m.uri ? "border-brand ring-4 ring-brand/10 shadow-lg scale-[1.05] z-10" : "border-line opacity-60 hover:opacity-100"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.uri} alt="預覽" className="w-full h-full object-cover" />
                    {coverImage === m.uri && (
                      <div className="absolute top-2 right-2 bg-brand text-white p-1 rounded-full shadow-md">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeMedia(m.uri)}
                  title="移除"
                  className="absolute -top-2 -left-2 bg-white text-ink/40 hover:text-brand border border-line rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <XCircle size={16} />
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="font-sans text-sm text-ink/30 text-center py-2">
          尚未上傳任何圖片或影片。
        </p>
      )}
    </div>
  );
}
