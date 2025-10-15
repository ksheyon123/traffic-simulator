interface BoundsParams {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface RoadData {
  id: number;
  type: string;
  name: string;
  coordinates: [number, number][];
  tags: Record<string, string>;
}

interface RoadApiResponse {
  success: boolean;
  bounds: BoundsParams;
  roadCount: number;
  roads: RoadData[];
}

interface ApiErrorResponse {
  error: string;
  details?: string;
}

/**
 * OSM에서 도로 정보를 가져오는 함수
 * @param bounds - 지도 bounds [north, south, east, west]
 * @returns 도로 정보 데이터
 */
export async function fetchRoadsFromOSM(
  bounds: [number, number, number, number]
): Promise<RoadApiResponse> {
  const [north, south, east, west] = bounds;

  try {
    const response = await fetch("/api/roads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        north,
        south,
        east,
        west,
      }),
    });

    if (!response.ok) {
      const errorData: ApiErrorResponse = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    const data: RoadApiResponse = await response.json();
    return data;
  } catch (error) {
    console.error("도로 정보 가져오기 실패:", error);
    throw error;
  }
}

/**
 * 도로 타입별 색상 반환
 * @param roadType - 도로 타입
 * @returns 도로 색상
 */
export function getRoadColor(roadType: string): string {
  const colorMap: Record<string, string> = {
    motorway: "#e66465", // 고속도로 - 빨간색
    trunk: "#f93", // 간선도로 - 주황색
    primary: "#fcd53c", // 1차 도로 - 노란색
    secondary: "#9ed485", // 2차 도로 - 연한 초록색
    tertiary: "#87ceeb", // 3차 도로 - 하늘색
    residential: "#cccccc", // 주거지역 도로 - 회색
    service: "#e0e0e0", // 서비스 도로 - 연한 회색
    living_street: "#d3d3d3", // 생활도로 - 연한 회색
    unclassified: "#b8b8b8", // 미분류 도로 - 진한 회색
    unknown: "#999999", // 알 수 없음 - 진한 회색
  };

  return colorMap[roadType] || colorMap.unknown;
}

/**
 * 도로 타입별 굵기 반환
 * @param roadType - 도로 타입
 * @returns 도로 굵기 (픽셀)
 */
export function getRoadWidth(roadType: string): number {
  const widthMap: Record<string, number> = {
    motorway: 6, // 고속도로
    trunk: 5, // 간선도로
    primary: 4, // 1차 도로
    secondary: 3, // 2차 도로
    tertiary: 2, // 3차 도로
    residential: 2, // 주거지역 도로
    service: 1, // 서비스 도로
    living_street: 1, // 생활도로
    unclassified: 1, // 미분류 도로
    unknown: 1, // 알 수 없음
  };

  return widthMap[roadType] || widthMap.unknown;
}

/**
 * 도로 데이터를 Leaflet Polyline 형태로 변환
 * @param roads - 도로 데이터 배열
 * @returns Leaflet Polyline 옵션 배열
 */
export function convertRoadsToPolylines(roads: RoadData[]) {
  return roads.map((road) => ({
    positions: road.coordinates,
    options: {
      color: getRoadColor(road.type),
      weight: getRoadWidth(road.type),
      opacity: 0.8,
    },
    popup: {
      content: `
        <div>
          <h4>${road.name || "이름 없는 도로"}</h4>
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
      `,
    },
  }));
}
