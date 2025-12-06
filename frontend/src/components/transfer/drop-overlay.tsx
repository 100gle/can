import { useFileDrop } from "@/hooks/useFileDrop";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import "./drop-overlay.css";

interface DropOverlayProps {
  /** Callback when files are dropped, receives array of absolute file paths */
  onFilesDropped?: (paths: string[]) => void;
}

/**
 * Fullscreen overlay that appears when files are dragged over the window.
 * Uses the useFileDrop hook to capture Wails native file drops.
 */
export function DropOverlay({ onFilesDropped }: DropOverlayProps) {
  const { droppedPaths, clearDroppedPaths, isActive } = useFileDrop();
  const { accountId } = useParams({ strict: false });
  const navigate = useNavigate();

  const handleDropComplete = useCallback(() => {
    if (droppedPaths.length > 0 && onFilesDropped) {
      onFilesDropped(droppedPaths);
      clearDroppedPaths();
    } else if (droppedPaths.length > 0) {
      // Default behavior: navigate to transfers page with the dropped files
      // Store dropped paths in sessionStorage for the uploads page to pick up
      sessionStorage.setItem("pendingUploads", JSON.stringify(droppedPaths));
      clearDroppedPaths();

      // Navigate to transfers page if we have an account context
      if (accountId) {
        navigate({ to: "/accounts/$accountId/transfers", params: { accountId } });
      }
    }
  }, [droppedPaths, onFilesDropped, clearDroppedPaths, accountId, navigate]);

  useEffect(() => {
    if (droppedPaths.length > 0) {
      handleDropComplete();
    }
  }, [droppedPaths, handleDropComplete]);

  // Only show overlay briefly when files are actively being dropped
  if (!isActive) {
    return null;
  }

  return (
    <div className="drop-overlay">
      <div className="drop-overlay-content">
        <div className="drop-overlay-icon">
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <h2 className="drop-overlay-title">Drop to Upload</h2>
        <p className="drop-overlay-subtitle">Release files to add them to the upload queue</p>
      </div>
    </div>
  );
}
