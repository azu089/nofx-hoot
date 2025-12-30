'use client';

import { forwardRef, HTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
  status?: 'online' | 'offline' | 'busy' | 'away';
}

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, src, alt, size = 'md', fallback, status, ...props }, ref) => {
    const [imageError, setImageError] = useState(false);

    const sizes = {
      xs: 'w-6 h-6 text-xs',
      sm: 'w-8 h-8 text-sm',
      md: 'w-10 h-10 text-base',
      lg: 'w-12 h-12 text-lg',
      xl: 'w-16 h-16 text-xl',
    };

    const statusSizes = {
      xs: 'w-1.5 h-1.5',
      sm: 'w-2 h-2',
      md: 'w-2.5 h-2.5',
      lg: 'w-3 h-3',
      xl: 'w-4 h-4',
    };

    const statusColors = {
      online: 'bg-success',
      offline: 'bg-text-disabled',
      busy: 'bg-danger',
      away: 'bg-warning',
    };

    const getInitials = (text: string) => {
      return text
        .split(' ')
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };

    const showImage = src && !imageError;
    const showFallback = fallback && (!src || imageError);

    return (
      <div ref={ref} className={cn('relative inline-block', className)} {...props}>
        <div
          className={cn(
            'flex items-center justify-center rounded-full overflow-hidden',
            'bg-bg-tertiary border border-border-primary',
            sizes[size]
          )}
        >
          {showImage ? (
            <img
              src={src}
              alt={alt || 'Avatar'}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : showFallback ? (
            <span className="font-medium text-text-primary">{getInitials(fallback)}</span>
          ) : (
            <User className="w-1/2 h-1/2 text-text-tertiary" />
          )}
        </div>
        {status && (
          <span
            className={cn(
              'absolute bottom-0 right-0 rounded-full border-2 border-bg-primary',
              statusSizes[size],
              statusColors[status]
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// AvatarGroup
export interface AvatarGroupProps extends HTMLAttributes<HTMLDivElement> {
  max?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max = 4, size = 'md', children, ...props }, ref) => {
    const childArray = Array.isArray(children) ? children : [children];
    const visibleAvatars = childArray.slice(0, max);
    const remainingCount = childArray.length - max;

    const overlapStyles = {
      xs: '-ml-2',
      sm: '-ml-2.5',
      md: '-ml-3',
      lg: '-ml-4',
      xl: '-ml-5',
    };

    return (
      <div ref={ref} className={cn('flex items-center', className)} {...props}>
        {visibleAvatars.map((child, index) => (
          <div
            key={index}
            className={cn(index > 0 && overlapStyles[size])}
            style={{ zIndex: visibleAvatars.length - index }}
          >
            {child}
          </div>
        ))}
        {remainingCount > 0 && (
          <div className={overlapStyles[size]}>
            <Avatar size={size} fallback={`+${remainingCount}`} />
          </div>
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';

export { Avatar, AvatarGroup };
