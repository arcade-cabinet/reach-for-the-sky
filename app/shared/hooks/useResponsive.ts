import { useEffect, useState } from "react";

export interface ViewportInfo {
  width: number;
  height: number;
  aspectRatio: number;
  isPortrait: boolean;
  isMobile: boolean;
}

export function useResponsive(): ViewportInfo {
  const [info, setInfo] = useState<ViewportInfo>({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
    aspectRatio: typeof window !== "undefined" ? window.innerWidth / window.innerHeight : 1,
    isPortrait: typeof window !== "undefined" ? window.innerHeight > window.innerWidth : false,
    isMobile: typeof window !== "undefined" ? window.innerWidth < 768 : false,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setInfo({
        width,
        height,
        aspectRatio: width / height,
        isPortrait: height > width,
        isMobile: width < 768,
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return info;
}
