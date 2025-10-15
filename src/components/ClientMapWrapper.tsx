"use client";

import dynamic from "next/dynamic";

const MapOverlay = dynamic(() => import("./TrafficSimulator"), {
  ssr: false,
  loading: () => <p>지도를 로딩 중입니다...</p>,
});

export default function ClientMapWrapper() {
  return <MapOverlay />;
}
