interface Point {
  lat: number;
  lng: number;
}

/**
 * Ray-casting algorithm to determine if a point falls inside a polygon.
 * Works with any convex or concave polygon defined by an array of lat/lng vertices.
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat;
    const yi = polygon[i].lng;
    const xj = polygon[j].lat;
    const yj = polygon[j].lng;

    const intersect =
      yi > point.lng !== yj > point.lng &&
      point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

export interface PolygonRule {
  id: number;
  name: string;
  coordinates: Point[];
  color: string;
  matchOn: 'pickup' | 'delivery' | 'both';
  maxFootage: number | null;
  maxStops: number | null;
  onlyUnassignedType: 'pickup' | 'delivery' | 'either' | null;
  loadTypeFilter: Record<string, boolean> | null;
}

export interface MatchableOrder {
  id: number;
  pickupLat: number | null;
  pickupLng: number | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  pickupAssigned: boolean;
  deliveryAssigned: boolean;
  ohToIn: boolean;
  backhaul: boolean;
  localSemi: boolean;
  localFlatbed: boolean;
  rrOrder: boolean;
  middlefield: boolean;
  paNy: boolean;
  totalFootage: number;
}

export interface MatchResult {
  polygonId: number;
  orderId: number;
}

const LOAD_TYPE_MAP: Record<string, keyof MatchableOrder> = {
  oh_to_in: 'ohToIn',
  backhaul: 'backhaul',
  local_semi: 'localSemi',
  local_flatbed: 'localFlatbed',
  rr_order: 'rrOrder',
  middlefield: 'middlefield',
  pa_ny: 'paNy',
};

function orderPassesRules(order: MatchableOrder, polygon: PolygonRule): boolean {
  if (polygon.onlyUnassignedType) {
    if (polygon.onlyUnassignedType === 'pickup' && order.pickupAssigned) return false;
    if (polygon.onlyUnassignedType === 'delivery' && order.deliveryAssigned) return false;
    if (polygon.onlyUnassignedType === 'either' && order.pickupAssigned && order.deliveryAssigned) return false;
  }

  if (polygon.loadTypeFilter) {
    const hasMatchingFlag = Object.entries(polygon.loadTypeFilter).some(
      ([flag, required]) => required && order[LOAD_TYPE_MAP[flag] as keyof MatchableOrder]
    );
    const anyFilterActive = Object.values(polygon.loadTypeFilter).some(Boolean);
    if (anyFilterActive && !hasMatchingFlag) return false;
  }

  return true;
}

/**
 * Match orders against polygons. Returns which orders fall inside which polygons.
 * An order can only match ONE polygon (first match wins based on polygon array order).
 */
export function matchOrdersToPolygons(
  orders: MatchableOrder[],
  polygons: PolygonRule[]
): { matches: MatchResult[]; unmatched: number[] } {
  const matches: MatchResult[] = [];
  const matchedOrderIds = new Set<number>();

  for (const polygon of polygons) {
    for (const order of orders) {
      if (matchedOrderIds.has(order.id)) continue;

      let matched = false;

      if (polygon.matchOn === 'both') {
        const pickupInside =
          order.pickupLat != null &&
          order.pickupLng != null &&
          isPointInPolygon({ lat: order.pickupLat, lng: order.pickupLng }, polygon.coordinates);
        const deliveryInside =
          order.deliveryLat != null &&
          order.deliveryLng != null &&
          isPointInPolygon({ lat: order.deliveryLat, lng: order.deliveryLng }, polygon.coordinates);
        matched = pickupInside || deliveryInside;
      } else {
        const lat = polygon.matchOn === 'pickup' ? order.pickupLat : order.deliveryLat;
        const lng = polygon.matchOn === 'pickup' ? order.pickupLng : order.deliveryLng;
        if (lat == null || lng == null) continue;
        matched = isPointInPolygon({ lat, lng }, polygon.coordinates);
      }

      if (!matched) continue;

      if (!orderPassesRules(order, polygon)) continue;

      matches.push({ polygonId: polygon.id, orderId: order.id });
      matchedOrderIds.add(order.id);
    }
  }

  const unmatched = orders
    .filter((o) => !matchedOrderIds.has(o.id))
    .map((o) => o.id);

  return { matches, unmatched };
}
