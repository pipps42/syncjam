import { useState, useRef, useEffect } from 'react';
import { formatDuration } from '../../types/spotify';

interface ProgressBarProps {
  currentPosition: number; // in milliseconds
  duration: number; // in milliseconds
  isSeekable: boolean; // true only for host
  onSeek?: (positionMs: number) => void;
}

export function ProgressBar({ currentPosition, duration, isSeekable, onSeek }: ProgressBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Use drag position while dragging, otherwise use current position
  const displayPosition = isDragging ? dragPosition : currentPosition;
  const progress = duration > 0 ? (displayPosition / duration) * 100 : 0;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current) return;

      const rect = progressBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const position = Math.floor(percentage * duration);

      setDragPosition(position);
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      // Call onSeek with final position
      if (onSeek && isSeekable) {
        onSeek(dragPosition);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragPosition, duration, onSeek, isSeekable]);

  // Handle touch events for mobile
  useEffect(() => {
    if (!isDragging) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (!progressBarRef.current || e.touches.length === 0) return;

      const rect = progressBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const position = Math.floor(percentage * duration);

      setDragPosition(position);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);

      // Call onSeek with final position
      if (onSeek && isSeekable) {
        onSeek(dragPosition);
      }
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, dragPosition, duration, onSeek, isSeekable]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSeekable) return;

    e.preventDefault();
    setIsDragging(true);

    // Set initial drag position
    if (progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const position = Math.floor(percentage * duration);
      setDragPosition(position);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isSeekable || e.touches.length === 0) return;

    e.preventDefault();
    setIsDragging(true);

    // Set initial drag position
    if (progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const position = Math.floor(percentage * duration);
      setDragPosition(position);
    }
  };

  return (
    <div className="progress-section">
      <div
        ref={progressBarRef}
        className={`progress-bar ${isSeekable ? 'seekable' : ''} ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}>
            {isSeekable && (
              <div className="progress-thumb"></div>
            )}
          </div>
        </div>
      </div>

      <div className="progress-time">
        <span className="time-current">{formatDuration(displayPosition)}</span>
        <span className="time-duration">{formatDuration(duration)}</span>
      </div>
    </div>
  );
}
