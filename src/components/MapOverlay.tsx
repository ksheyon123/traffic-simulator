"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  Engine,
  Scene,
  UniversalCamera,
  Vector3,
  HemisphericLight,
  MeshBuilder,
  StandardMaterial,
  Color3,
} from "@babylonjs/core";

const MapOverlay = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || !canvasRef.current)
      return;

    // Leaflet 지도 초기화
    const map = L.map(mapRef.current, {
      center: [37.5665, 126.978], // 서울 좌표
      zoom: 13,
      zoomControl: true,
    });

    // 타일 레이어 추가
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    mapInstanceRef.current = map;

    // Babylon.js 엔진 및 씬 초기화
    const engine = new Engine(canvasRef.current, true);
    const scene = new Scene(engine);

    // 카메라 설정
    const camera = new UniversalCamera(
      "camera",
      new Vector3(0, 10, -10),
      scene
    );
    camera.setTarget(Vector3.Zero());

    // 조명 설정
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // 샘플 3D 객체 생성 (빨간 구)
    const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 2 }, scene);
    sphere.position.y = 1;

    const sphereMaterial = new StandardMaterial("sphereMaterial", scene);
    sphereMaterial.diffuseColor = new Color3(1, 0, 0);
    sphere.material = sphereMaterial;

    // 바닥 평면
    const ground = MeshBuilder.CreateGround(
      "ground",
      { width: 20, height: 20 },
      scene
    );
    const groundMaterial = new StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseColor = new Color3(0.2, 0.8, 0.2);
    groundMaterial.alpha = 0.5;
    ground.material = groundMaterial;

    engineRef.current = engine;
    sceneRef.current = scene;

    // 렌더링 루프 시작
    engine.runRenderLoop(() => {
      scene.render();
    });

    // 윈도우 리사이즈 핸들러
    const handleResize = () => {
      engine.resize();
      map.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    // 지도 이벤트 리스너 - 지도 이동 시 3D 씬 업데이트
    const updateBabylonPosition = () => {
      // 지도 중심 좌표를 3D 씬에 반영 (예시)
      const center = map.getCenter();
      if (scene && sphere) {
        // 실제 프로젝트에서는 GPS 좌표를 3D 좌표로 변환하는 로직이 필요
        sphere.position.x = (center.lng - 126.978) * 100;
        sphere.position.z = (center.lat - 37.5665) * 100;
      }
    };

    map.on("move", updateBabylonPosition);

    return () => {
      // 클린업
      window.removeEventListener("resize", handleResize);
      map.off("move", updateBabylonPosition);
      if (engineRef.current) {
        engineRef.current.dispose();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
    };
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      {/* Leaflet 지도 */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 1,
        }}
      />

      {/* Babylon.js 3D 캔버스 오버레이 */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          width: "300px",
          height: "200px",
          border: "2px solid #333",
          borderRadius: "8px",
          zIndex: 1000,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
        }}
      />
    </div>
  );
};

export default MapOverlay;
