import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Image as ImageIcon } from "lucide-react";

export interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackIcon?: React.ReactNode;
  containerClassName?: string;
}

export function LazyImage({
  src,
  alt = "",
  className = "",
  containerClassName = "",
  loading = "lazy",
  decoding = "async",
  fallbackIcon,
  onLoad,
  onError,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src) {
    return (
      <div className={cn("flex h-full w-full items-center justify-center bg-muted/20 text-muted-foreground", containerClassName)}>
        {fallbackIcon || <ImageIcon className="h-6 w-6 opacity-40" />}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden bg-muted/20", containerClassName)}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-muted/30 animate-pulse flex items-center justify-center">
          <ImageIcon className="h-5 w-5 text-muted-foreground/30 animate-pulse" />
        </div>
      )}

      {hasError ? (
        <div className="flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground">
          {fallbackIcon || <ImageIcon className="h-6 w-6 opacity-40" />}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={loading}
          decoding={decoding}
          onLoad={(e) => {
            setIsLoaded(true);
            onLoad?.(e);
          }}
          onError={(e) => {
            setHasError(true);
            onError?.(e);
          }}
          className={cn(
            "transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          {...props}
        />
      )}
    </div>
  );
}
