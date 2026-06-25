"use client";

import { App, ConfigProvider, theme } from "antd";
import zhTW from "antd/locale/zh_TW";
import type { ReactNode } from "react";

export default function AntdProvider({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider
      locale={zhTW}
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: "#4f7eff",
          colorBgBase: "#080d16",
          colorBgContainer: "#101826",
          colorBgElevated: "#162132",
          colorBorder: "#223149",
          colorText: "#f3f6ff",
          colorTextSecondary: "#8d9bb4",
          borderRadius: 8,
        },
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}
