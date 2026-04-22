import type { ContainerSize } from "@logic/shared";
import type { RefObject } from "react";
import { useEffect, useState } from "react";

const EMPTY_SIZE: ContainerSize = { width: 0, height: 0 };

export function useContainerSize<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [size, setSize] = useState<ContainerSize>(EMPTY_SIZE);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const update = () => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => observer.disconnect();
  }, [ref]);

  return size;
}
