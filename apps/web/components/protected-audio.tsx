'use client';

/** Reproductor de demos de la red: sin botón de descarga ni menú contextual (la URL real dura 60 s). */
export function ProtectedAudio({ fileId, label }: { fileId: string; label: string }) {
  return (
    <audio
      controls
      preload="none"
      controlsList="nodownload noplaybackrate"
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      src={`/api/audio/${fileId}`}
      className="w-full"
    />
  );
}
