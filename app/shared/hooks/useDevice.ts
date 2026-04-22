import { Device } from "@capacitor/device";
import { useEffect, useState } from "react";

export interface DeviceInfo {
  platform: "web" | "ios" | "android";
  isNative: boolean;
  hasTouch: boolean;
}

export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>({
    platform: "web",
    isNative: false,
    hasTouch: false,
  });

  useEffect(() => {
    const checkDevice = async () => {
      const device = await Device.getInfo();
      const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

      setInfo({
        platform: device.platform as "web" | "ios" | "android",
        isNative: device.platform !== "web",
        hasTouch,
      });
    };

    checkDevice();
  }, []);

  return info;
}
