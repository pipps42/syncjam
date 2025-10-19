import { type ImgHTMLAttributes, useState } from 'react';
import './Avatar.css';

interface AvatarProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'circle' | 'square';
}

export function Avatar({
  src,
  name,
  size = 'md',
  variant = 'circle',
  className = '',
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Get initials from name
  const getInitials = (name?: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const classes = [
    'avatar',
    `avatar-${size}`,
    `avatar-${variant}`,
    className
  ].filter(Boolean).join(' ');

  const shouldShowImage = src && !imageError;

  return (
    <div className={classes}>
      {shouldShowImage ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          onError={() => setImageError(true)}
          {...props}
        />
      ) : (
        <span className="avatar-initials">
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
