"use client";
import { fallbackImage } from "@/utils/secret";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";

type ImageWithFallbackProps = ImageProps & {
  fallbackSrc?: string;
};

export const ImageWithFallback = ({
  src,
  alt = "Fallback Image",
  width = 100,
  height = 100,
  loading = "lazy",
  className,
  fallbackSrc,
  ...rest
}: ImageWithFallbackProps) => {
  const [imgSrc, setImageSrc] = useState<ImageProps["src"]>(src || "/");
  return (
    <Image
      alt={alt}
      src={imgSrc}
      onError={() => {
        setImageSrc(fallbackSrc || fallbackImage);
      }}
      loading={loading}
      className={className}
      width={width}
      height={height}
      {...rest}
    />
  );
};
