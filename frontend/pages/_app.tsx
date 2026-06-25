import type { AppProps } from "next/app";
import AntdProvider from "@/components/AntdProvider";
import MSWProvider from "@/components/MSWProvider";
import QueryProvider from "@/components/QueryProvider";
import "@/styles/globals.scss";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MSWProvider>
      <QueryProvider>
        <AntdProvider>
          <Component {...pageProps} />
        </AntdProvider>
      </QueryProvider>
    </MSWProvider>
  );
}
