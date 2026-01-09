"use client";

import { useState, useEffect } from "react";

interface UploadConfig {
  maxImageUploadMB: number;
  maxImageUploadBytes: number;
  iconUploadEnabled: boolean;
}

const defaultConfig: UploadConfig = {
  maxImageUploadMB: 5,
  maxImageUploadBytes: 5 * 1024 * 1024,
  iconUploadEnabled: true,
};

export function useUploadConfig() {
  const [config, setConfig] = useState<UploadConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/config/upload")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
      })
      .catch((err) => {
        console.error("Failed to fetch upload config:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const validateFileSize = (file: File): { valid: boolean; error?: string } => {
    if (!config.iconUploadEnabled) {
      return { valid: false, error: "Icon upload is disabled" };
    }
    if (file.size > config.maxImageUploadBytes) {
      return {
        valid: false,
        error: `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds limit (${config.maxImageUploadMB}MB)`,
      };
    }
    return { valid: true };
  };

  return {
    ...config,
    loading,
    validateFileSize,
  };
}
