import React, { useEffect, useRef, useState } from "react";
import * as BABYLON from "@babylonjs/core";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchRoadsFromOSM } from "../utils/roadApi";

// 타입 정의
interface Vehicle {
  mesh: BABYLON.Mesh;
  lat: number;
  lng: number;
  speed: number;
  direction: number;
}

interface WorldPosition {
  x: number;
  y: number;
  z: number;
}

const TrafficSimulator = () => {
  const leafletContainerRef = useRef<HTMLDivElement>(null);
  const babylonCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isReady, setIsReady] = useState(false);

  const mapRef = useRef<L.Map | null>(null);
  const sceneRef = useRef<BABYLON.Scene | null>(null);
  const engineRef = useRef<BABYLON.Engine | null>(null);
  const cameraRef = useRef<BABYLON.FreeCamera | null>(null);
  const vehiclesRef = useRef<Vehicle[]>([]);

  const [bounds, setBounds] = useState<number[]>();
  const [isLoadingRoads, setIsLoadingRoads] = useState(false);
  const [roadData, setRoadData] = useState<any[]>([]);
  const [roadsLayerGroup, setRoadsLayerGroup] = useState<L.LayerGroup | null>(
    null
  );

  useEffect(() => {
    if (!leafletContainerRef.current || !babylonCanvasRef.current) return;

    // 1. Leaflet 지도 초기화
    const map = L.map(leafletContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([37.5665, 126.978], 19); // 서울 시청 좌표

    // OpenStreetMap 타일 레이어
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // 초기 bounds 설정
    const initialBounds = map.getBounds();
    const north = initialBounds.getNorth();
    const south = initialBounds.getSouth();
    const east = initialBounds.getEast();
    const west = initialBounds.getWest();
    setBounds([north, south, east, west]);

    mapRef.current = map;

    // 2. Babylon.js 초기화
    const engine = new BABYLON.Engine(babylonCanvasRef.current, true, {
      preserveDrawingBuffer: true,
      stencil: true,
    });
    engineRef.current = engine;

    const scene = new BABYLON.Scene(engine);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // 투명 배경
    sceneRef.current = scene;

    // 카메라 설정 (탑뷰)
    const camera = new BABYLON.FreeCamera(
      "camera",
      new BABYLON.Vector3(0, 100, 0),
      scene
    );
    camera.setTarget(BABYLON.Vector3.Zero());
    cameraRef.current = camera;

    // 조명
    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene
    );
    light.intensity = 1.2;

    // 3. 좌표 변환 함수
    const latLngToWorld = (lat: number, lng: number): BABYLON.Vector3 => {
      const point = map.latLngToContainerPoint([lat, lng]);
      const containerSize = map.getSize();

      // 지도 중심을 3D 원점으로
      const x = (point.x - containerSize.x / 2) * 0.1;
      const z = -(point.y - containerSize.y / 2) * 0.1;

      return new BABYLON.Vector3(x, 0, z);
    };

    // 4. 샘플 차량 생성
    const createVehicle = (
      lat: number,
      lng: number,
      color: BABYLON.Color3
    ): Vehicle => {
      const vehicle = BABYLON.MeshBuilder.CreateBox(
        "vehicle",
        { width: 2, height: 1.5, depth: 4 },
        scene
      );

      const material = new BABYLON.StandardMaterial("vehicleMat", scene);
      material.diffuseColor = color;
      material.emissiveColor = new BABYLON.Color3(0.2, 0.2, 0.2);
      vehicle.material = material;

      const position = latLngToWorld(lat, lng);
      vehicle.position = position;

      return {
        mesh: vehicle,
        lat,
        lng,
        speed: 0.0001,
        direction: Math.random() * Math.PI * 2,
      };
    };

    // 초기 차량들 생성
    const vehicles: Vehicle[] = [
      createVehicle(37.5665, 126.978, new BABYLON.Color3(1, 0, 0)),
      createVehicle(37.567, 126.9785, new BABYLON.Color3(0, 0, 1)),
      createVehicle(37.566, 126.9775, new BABYLON.Color3(0, 1, 0)),
      createVehicle(37.5668, 126.9782, new BABYLON.Color3(1, 1, 0)),
    ];
    vehiclesRef.current = vehicles;

    // 5. 지도 이동/줌 이벤트 처리
    const updateBabylonPositions = (): void => {
      // bounds 업데이트
      const currentBounds = map.getBounds();
      const north = currentBounds.getNorth();
      const south = currentBounds.getSouth();
      const east = currentBounds.getEast();
      const west = currentBounds.getWest();
      setBounds([north, south, east, west]);

      // 차량 위치 업데이트
      vehicles.forEach((vehicle) => {
        const newPos = latLngToWorld(vehicle.lat, vehicle.lng);
        vehicle.mesh.position = newPos;
      });
    };

    map.on("move", updateBabylonPositions);
    map.on("zoom", updateBabylonPositions);
    map.on("moveend", updateBabylonPositions);
    map.on("zoomend", updateBabylonPositions);

    // 6. 애니메이션 루프
    engine.runRenderLoop(() => {
      // 차량 이동 시뮬레이션
      vehicles.forEach((vehicle) => {
        // 위도/경도 업데이트 (간단한 직선 이동)
        vehicle.lat += Math.cos(vehicle.direction) * vehicle.speed;
        vehicle.lng += Math.sin(vehicle.direction) * vehicle.speed;

        // 3D 위치 업데이트
        const newPos = latLngToWorld(vehicle.lat, vehicle.lng);
        vehicle.mesh.position = newPos;
        vehicle.mesh.rotation.y = vehicle.direction;

        // 경계 체크 (지도 범위 벗어나면 방향 전환)
        const currentBounds = map.getBounds();
        if (
          vehicle.lat > currentBounds.getNorth() ||
          vehicle.lat < currentBounds.getSouth() ||
          vehicle.lng > currentBounds.getEast() ||
          vehicle.lng < currentBounds.getWest()
        ) {
          vehicle.direction += Math.PI;
        }
      });

      scene.render();
    });

    // 리사이즈 처리
    const handleResize = (): void => {
      engine.resize();
      updateBabylonPositions();
    };
    window.addEventListener("resize", handleResize);

    setIsReady(true);

    // 정리
    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
      scene.dispose();
      engine.dispose();
    };
  }, []);

  // OSM 도로 요청 함수
  const handleFetchRoads = async () => {
    if (!bounds || !mapRef.current) return;

    setIsLoadingRoads(true);
    try {
      const response = await fetchRoadsFromOSM(
        bounds as [number, number, number, number]
      );
      setRoadData(response.roads);

      // 기존 도로 레이어 제거
      if (roadsLayerGroup && mapRef.current) {
        mapRef.current.removeLayer(roadsLayerGroup);
      }

      // 새 도로 레이어 그룹 생성
      const newRoadsLayer = L.layerGroup();

      // 도로 데이터를 Leaflet polyline으로 변환하여 추가
      response.roads.forEach((road) => {
        if (road.coordinates && road.coordinates.length > 1) {
          // 도로 타입별 스타일 설정
          const getRoadStyle = (type: string) => {
            const styles: Record<string, any> = {
              motorway: { color: "#e66465", weight: 6, opacity: 0.8 },
              trunk: { color: "#f93", weight: 5, opacity: 0.8 },
              primary: { color: "#fcd53c", weight: 4, opacity: 0.8 },
              secondary: { color: "#9ed485", weight: 3, opacity: 0.8 },
              tertiary: { color: "#87ceeb", weight: 2, opacity: 0.8 },
              residential: { color: "#cccccc", weight: 2, opacity: 0.8 },
              service: { color: "#e0e0e0", weight: 1, opacity: 0.8 },
              living_street: { color: "#d3d3d3", weight: 1, opacity: 0.8 },
              unclassified: { color: "#b8b8b8", weight: 1, opacity: 0.8 },
            };
            return (
              styles[type] || { color: "#999999", weight: 1, opacity: 0.8 }
            );
          };

          const polyline = L.polyline(
            road.coordinates,
            getRoadStyle(road.type)
          );

          // 팝업 추가
          polyline.bindPopup(`
            <div class="text-sm">
              <h4 class="font-bold">${road.name || "이름 없는 도로"}</h4>
              <p><strong>타입:</strong> ${road.type}</p>
              <p><strong>ID:</strong> ${road.id}</p>
              ${
                road.tags.maxspeed
                  ? `<p><strong>제한속도:</strong> ${road.tags.maxspeed}</p>`
                  : ""
              }
              ${
                road.tags.lanes
                  ? `<p><strong>차선 수:</strong> ${road.tags.lanes}</p>`
                  : ""
              }
            </div>
          `);

          newRoadsLayer.addLayer(polyline);
        }
      });

      // 지도에 도로 레이어 추가
      newRoadsLayer.addTo(mapRef.current);
      setRoadsLayerGroup(newRoadsLayer);

      console.log(`OSM에서 ${response.roads.length}개의 도로를 가져왔습니다.`);
    } catch (error) {
      console.error("OSM 도로 요청 실패:", error);
      alert("도로 정보를 가져오는데 실패했습니다.");
    } finally {
      setIsLoadingRoads(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-gray-900">
      {/* 제목 */}
      <div className="absolute top-4 left-4 z-50 bg-white bg-opacity-90 px-4 py-2 rounded-lg shadow-lg">
        <h1 className="text-xl font-bold text-gray-800">
          도로 교통 시뮬레이터
        </h1>
        <p className="text-sm text-gray-600">
          Leaflet + Babylon.js + TypeScript
        </p>
      </div>

      {/* 컨트롤 패널 */}
      <div className="absolute top-4 right-4 z-50 bg-white bg-opacity-90 px-4 py-3 rounded-lg shadow-lg">
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span>차량 1</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>차량 2</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span>차량 3</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span>차량 4</span>
          </div>
        </div>

        {/* Bounds 정보 표시 */}
        {bounds && (
          <div className="mt-3 pt-3 border-t border-gray-300">
            <p className="text-xs font-semibold mb-1">현재 지도 범위:</p>
            <div className="text-xs text-gray-600 space-y-0.5">
              <div>북: {bounds[0].toFixed(6)}</div>
              <div>남: {bounds[1].toFixed(6)}</div>
              <div>동: {bounds[2].toFixed(6)}</div>
              <div>서: {bounds[3].toFixed(6)}</div>
            </div>
          </div>
        )}
      </div>

      {/* 사용법 안내 */}
      <div className="absolute bottom-4 left-4 z-50 bg-white bg-opacity-90 px-4 py-3 rounded-lg shadow-lg max-w-xs">
        <h3 className="font-semibold text-sm mb-2">사용법</h3>
        <ul className="text-xs space-y-1 text-gray-700">
          <li>• 드래그로 지도 이동</li>
          <li>• 휠로 줌 조절</li>
          <li>• 3D 차량이 지도와 동기화됩니다</li>
          <li>• 지도 이동 시 bounds가 실시간 업데이트됩니다</li>
        </ul>
      </div>

      {/* OSM 도로 요청 버튼 */}
      <div className="absolute bottom-4 right-4 z-50">
        <button
          onClick={handleFetchRoads}
          disabled={isLoadingRoads || !bounds}
          className={`
            px-4 py-3 rounded-lg shadow-lg font-semibold text-sm transition-all duration-200
            ${
              isLoadingRoads || !bounds
                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                : "bg-blue-500 hover:bg-blue-600 text-white hover:shadow-xl transform hover:scale-105"
            }
          `}
        >
          {isLoadingRoads ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>도로 로딩...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <span>OSM 도로 요청</span>
            </div>
          )}
        </button>

        {/* 도로 정보 표시 */}
        {roadData.length > 0 && (
          <div className="mt-2 bg-white bg-opacity-90 px-3 py-2 rounded-lg shadow-lg">
            <p className="text-xs text-gray-600">
              <span className="font-semibold text-green-600">
                {roadData.length}
              </span>
              개의 도로 표시됨
            </p>
          </div>
        )}
      </div>

      {/* Leaflet 지도 컨테이너 */}
      <div
        ref={leafletContainerRef}
        className="absolute inset-0 z-10"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Babylon.js 캔버스 (오버레이) */}
      <canvas
        ref={babylonCanvasRef}
        className="absolute inset-0 z-20 pointer-events-none"
        style={{ width: "100%", height: "100%" }}
      />

      {/* 로딩 표시 */}
      {!isReady && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-gray-900">
          <div className="text-white text-xl">로딩 중...</div>
        </div>
      )}
    </div>
  );
};

export default TrafficSimulator;
