'use client';

import { useState, useRef } from 'react';

interface Props {
  eventSlug: string;
  eventName: string;
  photoLimit: number;
}

type Step = 'landing' | 'select' | 'upload' | 'complete' | 'error';

interface PhotoState {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  driveFileId?: string;
  previewUrl?: string;
}

export function GuestUploadClient({ eventSlug, eventName, photoLimit }: Props) {
  const [step, setStep] = useState<Step>('landing');
  const [nickname, setNickname] = useState('');
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [overLimit, setOverLimit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Landing ──────────────────────────────────────────────────────────

  function handleContinue() {
    if (nickname.trim()) {
      setStep('select');
    }
  }

  // ── Step 2: Select ───────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > photoLimit) {
      setOverLimit(true);
      setPhotos(
        files.slice(0, photoLimit).map((file) => ({
          file,
          progress: 0,
          status: 'pending',
          previewUrl: URL.createObjectURL(file),
        }))
      );
    } else {
      setOverLimit(false);
      setPhotos(
        files.map((file) => ({
          file,
          progress: 0,
          status: 'pending',
          previewUrl: URL.createObjectURL(file),
        }))
      );
    }
  }

  async function handleUpload() {
    if (photos.length === 0 || overLimit) return;
    setStep('upload');
    const hadError = await uploadPhotos([...photos], nickname);
    setStep(hadError ? 'error' : 'complete');
  }

  // ── XHR Upload (non-aborting: continues past individual failures) ─────────────

  async function uploadPhotos(photoList: PhotoState[], nick: string): Promise<boolean> {
    let hadError = false;
    for (let i = 0; i < photoList.length; i++) {
      setPhotos((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: 'uploading' } : p))
      );

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', photoList[i].file);
        formData.append('nickname', nick);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setPhotos((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, progress: pct } : p))
            );
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText) as { driveFileId?: string };
            setPhotos((prev) =>
              prev.map((p, idx) =>
                idx === i
                  ? { ...p, status: 'done', progress: 100, driveFileId: data.driveFileId }
                  : p
              )
            );
          } else {
            hadError = true;
            setPhotos((prev) =>
              prev.map((p, idx) => (idx === i ? { ...p, status: 'error', progress: 0 } : p))
            );
          }
          resolve();
        };

        xhr.onerror = () => {
          hadError = true;
          setPhotos((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, status: 'error', progress: 0 } : p))
          );
          resolve();
        };

        xhr.open('POST', `/api/upload/${eventSlug}`);
        xhr.send(formData);
      });
    }
    return hadError;
  }

  // ── Retry only failed photos ─────────────────────────────────────────────────

  async function handleRetryFailed() {
    // Reset failed photos to pending
    const failedIndexes: number[] = [];
    setPhotos((prev) => {
      const next = prev.map((p, i) => {
        if (p.status === 'error') {
          failedIndexes.push(i);
          return { ...p, status: 'pending' as const, progress: 0 };
        }
        return p;
      });
      return next;
    });
    setStep('upload');
    // Give state a tick to settle before reading
    await new Promise((r) => setTimeout(r, 50));
    setPhotos((prev) => {
      const snapshot = [...prev];
      (async () => {
        const retries = snapshot.filter((_, i) => failedIndexes.includes(i));
        const indexMap = failedIndexes;
        let hadError = false;
        for (let j = 0; j < retries.length; j++) {
          const i = indexMap[j];
          await new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('file', retries[j].file);
            formData.append('nickname', nickname);

            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const pct = Math.round((e.loaded / e.total) * 100);
                setPhotos((p) => p.map((ph, idx) => (idx === i ? { ...ph, progress: pct } : ph)));
              }
            };

            xhr.onload = () => {
              if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText) as { driveFileId?: string };
                setPhotos((p) =>
                  p.map((ph, idx) =>
                    idx === i ? { ...ph, status: 'done', progress: 100, driveFileId: data.driveFileId } : ph
                  )
                );
              } else {
                hadError = true;
                setPhotos((p) => p.map((ph, idx) => (idx === i ? { ...ph, status: 'error', progress: 0 } : ph)));
              }
              resolve();
            };

            xhr.onerror = () => {
              hadError = true;
              setPhotos((p) => p.map((ph, idx) => (idx === i ? { ...ph, status: 'error', progress: 0 } : ph)));
              resolve();
            };

            xhr.open('POST', `/api/upload/${eventSlug}`);
            xhr.send(formData);
          });
        }
        setStep(hadError ? 'error' : 'complete');
      })();
      return snapshot;
    });
  }

  function handleSelectDifferent() {
    setPhotos([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStep('select');
  }

  const cardClass =
    'bg-white rounded-2xl shadow p-8 w-full max-w-md mx-auto';

  // ── Landing Step ─────────────────────────────────────────────────────────────

  if (step === 'landing') {
    return (
      <div
        style={{ backgroundColor: '#faf9f7', minHeight: '100vh' }}
        className="flex items-center justify-center px-4 py-12"
      >
        <div className={cardClass}>
          <h1 className="text-4xl font-semibold text-[#1a1a1a] mb-2">
            Welcome to {eventName}
          </h1>
          <p className="text-base text-[#6b7280] mb-6">
            Share your photos with the couple.
          </p>

          <label htmlFor="nickname" className="block text-base text-[#1a1a1a] mb-1">
            Your nickname
          </label>
          <input
            id="nickname"
            type="text"
            placeholder="e.g. Aunt Sarah"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base text-[#1a1a1a] mb-6 focus:outline-none focus:ring-2 focus:ring-[#b85c52] min-h-[44px]"
          />

          <button
            onClick={handleContinue}
            disabled={!nickname.trim()}
            className="w-full text-white text-base font-semibold rounded-lg px-4 py-3 min-h-[44px] transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#b85c52' }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ── Select Step ──────────────────────────────────────────────────────────────

  if (step === 'select') {
    const photoCount = photos.length;
    const uploadLabel =
      photoCount === 1 ? 'Upload 1 photo →' : `Upload ${photoCount} photos →`;

    return (
      <div
        style={{ backgroundColor: '#faf9f7', minHeight: '100vh' }}
        className="flex items-start justify-center px-4 py-12"
      >
        <div className={cardClass}>
          <h2 className="text-3xl font-semibold text-[#1a1a1a] mb-1">
            Select your photos
          </h2>
          <p className="text-sm text-[#6b7280] mb-6">
            Up to {photoLimit} photos · JPEG, PNG, HEIC supported
          </p>

          {/* Hidden file input + styled label */}
          <label
            htmlFor="photo-picker"
            className="flex items-center justify-center w-full border-2 border-dashed border-gray-300 rounded-xl px-4 py-6 text-base text-[#6b7280] cursor-pointer min-h-[44px] hover:border-[#b85c52] transition-colors mb-4"
          >
            Choose photos
          </label>
          <input
            ref={fileInputRef}
            id="photo-picker"
            type="file"
            multiple
            accept="image/*,.HEIC,.heic"
            className="sr-only"
            onChange={handleFileChange}
          />

          {/* Over-limit error */}
          {overLimit && (
            <p className="text-sm text-[#dc2626] mb-4">
              Please select {photoLimit} or fewer photos
            </p>
          )}

          {/* Thumbnail grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-6">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative aspect-square">
                  {photo.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.previewUrl}
                      alt={photo.file.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={photoCount === 0 || overLimit}
            className="w-full text-white text-base font-semibold rounded-lg px-4 py-3 min-h-[44px] transition-opacity disabled:opacity-40"
            style={{ backgroundColor: '#b85c52' }}
          >
            {photoCount > 0 ? uploadLabel : 'Upload photos →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Upload Step ──────────────────────────────────────────────────────────────

  if (step === 'upload') {
    return (
      <div
        style={{ backgroundColor: '#faf9f7', minHeight: '100vh' }}
        className="flex items-start justify-center px-4 py-12"
      >
        <div className={cardClass}>
          <h2 className="text-3xl font-semibold text-[#1a1a1a] mb-6">
            Uploading your photos…
          </h2>

          <div className="space-y-4">
            {photos.map((photo, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[#6b7280] truncate max-w-[80%]">
                    {photo.file.name} · {photo.progress}%
                  </span>
                  {photo.status === 'done' && (
                    <span className="text-sm font-semibold" style={{ color: '#b85c52' }}>
                      ✓
                    </span>
                  )}
                  {photo.status === 'error' && (
                    <span className="text-sm font-semibold text-[#dc2626]">×</span>
                  )}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${photo.progress}%`,
                      backgroundColor: photo.status === 'error' ? '#dc2626' : '#b85c52',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Complete Step ─────────────────────────────────────────────────────────────

  if (step === 'complete') {
    const doneCount = photos.filter((p) => p.status === 'done').length;
    const photoWord = doneCount === 1 ? 'photo' : 'photos';
    return (
      <div
        style={{ backgroundColor: '#faf9f7', minHeight: '100vh' }}
        className="flex items-center justify-center px-4"
      >
        <div className={`${cardClass} text-center`}>
          <p className="text-6xl mb-4">🎉</p>
          <h2 className="text-3xl font-semibold text-[#1a1a1a] mb-2">
            You&apos;re all done!
          </h2>
          <p className="text-base text-[#6b7280] mb-4">
            {doneCount} {photoWord} uploaded to {eventName}
          </p>
          <p className="text-base text-[#1a1a1a] font-medium">
            Thank you for attending our special day! 💑
          </p>
        </div>
      </div>
    );
  }

  // ── Error Step ────────────────────────────────────────────────────────────────

  const doneCount = photos.filter((p) => p.status === 'done').length;
  const failedCount = photos.filter((p) => p.status === 'error').length;

  return (
    <div
      style={{ backgroundColor: '#faf9f7', minHeight: '100vh' }}
      className="flex items-center justify-center px-4"
    >
      <div className={`${cardClass}`}>
        <h2 className="text-3xl font-semibold text-[#1a1a1a] mb-2">
          Some photos failed
        </h2>
        <p className="text-base text-[#6b7280] mb-6">
          {doneCount > 0 && `${doneCount} uploaded · `}{failedCount} failed. You can retry the failed ones.
        </p>

        {/* Per-photo status list */}
        <div className="space-y-2 mb-6">
          {photos.map((photo, idx) => (
            <div key={idx} className="flex items-center gap-3 text-sm">
              <span
                className={`shrink-0 font-bold ${
                  photo.status === 'done' ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {photo.status === 'done' ? '✓' : '×'}
              </span>
              <span className="truncate text-[#6b7280]">{photo.file.name}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleRetryFailed}
          className="w-full text-white text-base font-semibold rounded-lg px-4 py-3 min-h-[44px] mb-3"
          style={{ backgroundColor: '#b85c52' }}
        >
          Retry failed ({failedCount})
        </button>
        <button
          onClick={handleSelectDifferent}
          className="w-full text-base text-[#6b7280] font-medium rounded-lg px-4 py-3 min-h-[44px] border border-gray-200 hover:bg-gray-50"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
