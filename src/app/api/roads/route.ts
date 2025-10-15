import { NextRequest, NextResponse } from "next/server";

interface BoundsParams {
  north: number;
  south: number;
  east: number;
  west: number;
}

interface OverpassNode {
  lat: number;
  lon: number;
}

interface OverpassElement {
  type: string;
  id: number;
  nodes?: number[];
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: OverpassNode[];
}

interface OverpassResponse {
  version: number;
  generator: string;
  elements: OverpassElement[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { north, south, east, west }: BoundsParams = body;

    // 입력 값 검증
    if (!north || !south || !east || !west) {
      return NextResponse.json(
        { error: "모든 bounds 값이 필요합니다 (north, south, east, west)" },
        { status: 400 }
      );
    }

    if (north <= south || east <= west) {
      return NextResponse.json(
        { error: "잘못된 bounds 값입니다" },
        { status: 400 }
      );
    }

    // Overpass API 쿼리 생성
    const overpassQuery = `
      [out:json][timeout:25];
      (
        way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|living_street)$"](${south},${west},${north},${east});
      );
      out geom;
    `;

    // Overpass API 호출
    const overpassUrl = "https://overpass-api.de/api/interpreter";
    const response = await fetch(overpassUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(overpassQuery)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API 호출 실패: ${response.status}`);
    }

    const data: OverpassResponse = await response.json();

    // 도로 데이터 가공
    const roads = data.elements
      .filter((element) => element.type === "way" && element.geometry)
      .map((way) => ({
        id: way.id,
        type: way.tags?.highway || "unknown",
        name: way.tags?.name || "",
        coordinates:
          way.geometry?.map((node: any) => [node.lat, node.lon]) || [],
        tags: way.tags || {},
      }));

    return NextResponse.json({
      success: true,
      bounds: { north, south, east, west },
      roadCount: roads.length,
      roads: roads,
    });
  } catch (error) {
    console.error("API 에러:", error);
    return NextResponse.json(
      {
        error: "OSM 도로 정보를 가져오는데 실패했습니다",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const north = parseFloat(searchParams.get("north") || "");
  const south = parseFloat(searchParams.get("south") || "");
  const east = parseFloat(searchParams.get("east") || "");
  const west = parseFloat(searchParams.get("west") || "");

  if (!north || !south || !east || !west) {
    return NextResponse.json(
      { error: "Query parameters가 필요합니다: north, south, east, west" },
      { status: 400 }
    );
  }

  // POST 메서드와 동일한 로직 실행
  const body = { north, south, east, west };
  const postRequest = new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });

  return POST(postRequest);
}
