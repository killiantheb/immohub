"use client";

/**
 * Modale fullscreen — gestion des photos d'un bien (PR-A11.A.5).
 *
 * Pattern hérité de CaracteristiquesModal (PR-A11.A.4) :
 *   - attemptClose() unifié — confirmation native si uploads en vol.
 *   - Listener Escape global tant que la modale est ouverte.
 *   - Scroll lock sur <body> pour éviter le scroll behind.
 *
 * Optimistic UX :
 *   - Réordonnancement (drag-and-drop framer-motion Reorder) : ordre local
 *     piloté par l'utilisateur, mutation backend déclenchée à chaque changement
 *     d'ordre. L'optimistic update du hook `useReorderBienImages` resync le
 *     cache `bienKeys.detail`.
 *   - Set cover : optimistic dans le hook `useUpdateBienImage` (bascule
 *     immédiate du flag `is_cover`).
 *   - Suppression : optimistic dans le hook `useDeleteBienImage` (retrait
 *     immédiat de la liste en cache).
 *   - Upload : état local de la modale avec placeholders + spinner. Les
 *     placeholders disparaissent à la résolution serveur (succès → image
 *     réelle apparaît via invalidate ; erreur → placeholder reste avec un
 *     message et un bouton « retirer »).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import {
  Loader2, Star, Trash2, Upload, X,
} from "lucide-react";
import {
  useBien,
  useUploadBienImage,
  useDeleteBienImage,
  useUpdateBienImage,
  useReorderBienImages,
} from "@/lib/hooks/useBiens";
import type { BienImage } from "@/lib/types";
import { C } from "@/lib/design-tokens";

interface Props {
  bienId: string;
  open: boolean;
  onClose: () => void;
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 10 * 1024 * 1024;

type PendingUpload = {
  tempId: string;
  fileName: string;
  previewUrl: string;
  status: "uploading" | "error";
  error?: string;
};

function newTempId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function PhotosManagerModal({ bienId, open, onClose }: Props) {
  const { data: bien } = useBien(bienId);
  const uploadMut = useUploadBienImage(bienId);
  const deleteMut = useDeleteBienImage(bienId);
  const patchMut = useUpdateBienImage(bienId);
  const reorderMut = useReorderBienImages(bienId);

  // Ordre local pour rendu drag-and-drop fluide. On resync depuis le cache
  // tant qu'on n'est pas en pleine opération de réordonnancement, sinon le
  // drag est interrompu par les invalidations React Query.
  const [localOrder, setLocalOrder] = useState<BienImage[]>([]);
  const isReorderingRef = useRef(false);

  useEffect(() => {
    if (isReorderingRef.current) return;
    setLocalOrder(bien?.images ?? []);
  }, [bien?.images]);

  // Uploads optimistes en attente — purement state local de la modale.
  const [pending, setPending] = useState<PendingUpload[]>([]);

  // Cleanup blob URLs à la destruction de chaque placeholder. On stocke les
  // URLs courantes dans une ref pour pouvoir les revoke au démontage final.
  const blobUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const urls = blobUrlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  const hasUploadsInFlight = useMemo(
    () => pending.some((p) => p.status === "uploading"),
    [pending],
  );

  const attemptClose = useCallback(() => {
    if (hasUploadsInFlight) {
      const ok = window.confirm(
        "Des uploads sont en cours. Fermer maintenant ne les annulera pas, mais vous perdrez la liste des erreurs éventuelles. Continuer ?",
      );
      if (!ok) return;
    }
    onClose();
  }, [hasUploadsInFlight, onClose]);

  // Reset des placeholders d'erreur à chaque ré-ouverture (sans révoquer les
  // blobs en vol pour ne pas casser un upload qui aboutit pendant la fermeture).
  useEffect(() => {
    if (!open) return;
    setPending((prev) => prev.filter((p) => p.status === "uploading"));
  }, [open]);

  // Listener Escape + scroll lock body pendant que la modale est ouverte.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, attemptClose]);

  if (!open) return null;

  // ── Handlers ────────────────────────────────────────────────────────────

  const trackBlob = (url: string) => {
    blobUrlsRef.current.add(url);
  };
  const revokeBlob = (url: string) => {
    if (blobUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      blobUrlsRef.current.delete(url);
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((file) => {
      const tempId = newTempId();
      const previewUrl = URL.createObjectURL(file);
      trackBlob(previewUrl);

      if (!ALLOWED_MIME.has(file.type)) {
        setPending((p) => [
          ...p,
          {
            tempId,
            fileName: file.name,
            previewUrl,
            status: "error",
            error: "Format non supporté (JPG, PNG, WebP ou GIF)",
          },
        ]);
        return;
      }
      if (file.size > MAX_BYTES) {
        setPending((p) => [
          ...p,
          {
            tempId,
            fileName: file.name,
            previewUrl,
            status: "error",
            error: "Fichier trop volumineux (max 10 MB)",
          },
        ]);
        return;
      }

      setPending((p) => [
        ...p,
        { tempId, fileName: file.name, previewUrl, status: "uploading" },
      ]);

      uploadMut
        .mutateAsync({ file, isCover: false })
        .then(() => {
          setPending((p) => p.filter((x) => x.tempId !== tempId));
          revokeBlob(previewUrl);
        })
        .catch((err: unknown) => {
          const detail =
            (err as { response?: { data?: { detail?: string } } })?.response
              ?.data?.detail;
          setPending((p) =>
            p.map((x) =>
              x.tempId === tempId
                ? {
                    ...x,
                    status: "error",
                    error: detail ?? "Échec de l'upload",
                  }
                : x,
            ),
          );
        });
    });
  };

  const handleDismissPending = (tempId: string) => {
    setPending((p) => {
      const target = p.find((x) => x.tempId === tempId);
      if (target) revokeBlob(target.previewUrl);
      return p.filter((x) => x.tempId !== tempId);
    });
  };

  const handleSetCover = (imageId: string) => {
    patchMut.mutate({ imageId, patch: { is_cover: true } });
  };

  const handleDelete = (imageId: string) => {
    if (!window.confirm("Supprimer cette photo ?")) return;
    deleteMut.mutate(imageId);
  };

  const handleReorder = (next: BienImage[]) => {
    isReorderingRef.current = true;
    setLocalOrder(next);
    reorderMut.mutate(
      { order: next.map((img) => img.id) },
      {
        onSettled: () => {
          isReorderingRef.current = false;
        },
      },
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const realCount = localOrder.length;
  const pendingCount = pending.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Galerie photos du bien"
      style={backdropStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) attemptClose();
      }}
    >
      <div style={shellStyle} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ minWidth: 0 }}>
            <h2 style={titleStyle}>Galerie photos</h2>
            <p style={subtitleStyle}>
              {realCount === 0 && pendingCount === 0
                ? "Aucune photo pour ce bien"
                : `${realCount} photo${realCount > 1 ? "s" : ""}${
                    pendingCount > 0 ? ` · ${pendingCount} en attente` : ""
                  }`}
            </p>
          </div>
          <button
            type="button"
            onClick={attemptClose}
            aria-label="Fermer"
            style={closeBtnStyle}
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          <div style={bodyInnerStyle}>
            <DropZone onFiles={handleFiles} />

            {realCount === 0 && pendingCount === 0 ? null : (
              <div style={{ marginTop: 24 }}>
                <p style={hintStyle}>
                  Glissez pour réorganiser. La première photo est utilisée comme
                  couverture par défaut — vous pouvez en désigner une autre via
                  l&apos;icône étoile.
                </p>

                {realCount > 0 && (
                  <Reorder.Group
                    axis="y"
                    values={localOrder}
                    onReorder={handleReorder}
                    style={listStyle}
                  >
                    {localOrder.map((img, idx) => (
                      <Reorder.Item
                        key={img.id}
                        value={img}
                        style={{
                          ...rowStyle,
                          borderColor: img.is_cover ? C.gold : C.border,
                        }}
                        whileDrag={{
                          scale: 1.02,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                          cursor: "grabbing",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={`Photo ${idx + 1}`}
                          style={thumbStyle}
                          draggable={false}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={photoLabelRowStyle}>
                            <span style={photoLabelStyle}>
                              Photo {idx + 1}
                            </span>
                            {img.is_cover && <CoverBadge />}
                          </div>
                          <p style={photoSubStyle}>
                            Glisser pour réorganiser
                          </p>
                        </div>
                        <div style={actionsStyle}>
                          {!img.is_cover && (
                            <button
                              type="button"
                              onClick={() => handleSetCover(img.id)}
                              aria-label="Définir comme photo de couverture"
                              title="Définir comme couverture"
                              style={iconBtnStyle}
                            >
                              <Star size={16} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(img.id)}
                            aria-label="Supprimer la photo"
                            title="Supprimer"
                            style={{ ...iconBtnStyle, color: C.red }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}

                {pendingCount > 0 && (
                  <ul
                    style={{
                      ...listStyle,
                      marginTop: realCount > 0 ? 12 : 0,
                    }}
                  >
                    {pending.map((p) => (
                      <li
                        key={p.tempId}
                        style={{
                          ...rowStyle,
                          background:
                            p.status === "error" ? C.redBg : "#fff",
                          borderColor:
                            p.status === "error" ? C.red : C.border,
                          cursor: "default",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.previewUrl}
                          alt=""
                          style={{ ...thumbStyle, opacity: 0.7 }}
                          draggable={false}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              ...photoLabelStyle,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {p.fileName}
                          </p>
                          <p
                            style={{
                              ...photoSubStyle,
                              color: p.status === "error" ? C.red : C.text3,
                            }}
                          >
                            {p.status === "uploading"
                              ? "Upload en cours…"
                              : (p.error ?? "Erreur")}
                          </p>
                        </div>
                        {p.status === "uploading" ? (
                          <Loader2
                            size={18}
                            className="animate-spin"
                            style={{ color: C.prussian, flexShrink: 0 }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDismissPending(p.tempId)}
                            aria-label="Retirer ce fichier"
                            title="Retirer"
                            style={iconBtnStyle}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <button type="button" onClick={attemptClose} style={ghostBtnStyle}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DropZone ────────────────────────────────────────────────────────────────

function DropZone({ onFiles }: { onFiles: (files: FileList | File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hovering, setHovering] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setHovering(true);
      }}
      onDragLeave={() => setHovering(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHovering(false);
        if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      style={{
        border: `2px dashed ${hovering ? C.gold : C.border2}`,
        background: hovering ? C.goldBg : C.surface2,
        borderRadius: 16,
        padding: "28px 20px",
        textAlign: "center",
        cursor: "pointer",
        transition: "border-color 200ms ease, background 200ms ease",
      }}
    >
      <Upload
        size={26}
        style={{ color: C.gold, display: "inline-block" }}
      />
      <p
        style={{
          margin: "10px 0 4px",
          fontSize: 15,
          fontWeight: 600,
          color: C.prussian,
        }}
      >
        Cliquez ou glissez vos photos ici
      </p>
      <p style={{ margin: 0, fontSize: 12, color: C.text3 }}>
        JPG, PNG, WebP ou GIF — jusqu&apos;à 10 MB par fichier
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function CoverBadge() {
  return (
    <span
      style={{
        marginLeft: 8,
        padding: "2px 8px",
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 999,
        background: C.goldBg,
        color: C.goldHover,
        border: `1px solid ${C.goldBorder}`,
        whiteSpace: "nowrap",
      }}
    >
      Couverture
    </span>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.6)",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  zIndex: 100,
};

const shellStyle: React.CSSProperties = {
  background: "#fff",
  width: "100%",
  maxWidth: "100%",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "18px 28px",
  borderBottom: "1px solid var(--border-subtle)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  background: "#fff",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  color: C.prussian,
  margin: 0,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: C.text3,
  margin: "2px 0 0",
};

const closeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: C.text3,
  padding: 4,
  lineHeight: 0,
  flexShrink: 0,
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "24px 0",
};

const bodyInnerStyle: React.CSSProperties = {
  maxWidth: 880,
  width: "100%",
  margin: "0 auto",
  padding: "0 28px",
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: C.text3,
  margin: "0 0 12px",
  lineHeight: 1.55,
};

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const rowStyle: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: 10,
  display: "flex",
  gap: 12,
  alignItems: "center",
  cursor: "grab",
};

const thumbStyle: React.CSSProperties = {
  width: 72,
  height: 72,
  objectFit: "cover",
  borderRadius: 8,
  flexShrink: 0,
  background: C.surface2,
};

const photoLabelRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 4,
};

const photoLabelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: C.text,
  margin: 0,
};

const photoSubStyle: React.CSSProperties = {
  margin: "2px 0 0",
  fontSize: 12,
  color: C.text3,
};

const actionsStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  flexShrink: 0,
};

const iconBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: 8,
  cursor: "pointer",
  color: C.text2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "inherit",
};

const footerStyle: React.CSSProperties = {
  flexShrink: 0,
  padding: "14px 28px",
  borderTop: "1px solid var(--border-subtle)",
  display: "flex",
  justifyContent: "flex-end",
  background: "#fff",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "9px 22px",
  borderRadius: 10,
  border: `1px solid ${C.border}`,
  background: C.surface,
  color: C.text2,
  fontSize: 14,
  cursor: "pointer",
  fontFamily: "inherit",
};
