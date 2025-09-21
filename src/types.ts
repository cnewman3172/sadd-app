export type Role = 'ADMIN'|'COORDINATOR'|'TC'|'RIDER';

export type VanStatus = 'ACTIVE'|'MAINTENANCE'|'OFFLINE';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

export interface Van {
  id: string;
  name: string;
  capacity: number;
  status: VanStatus;
  passengers?: number;
  currentLat?: number | null;
  currentLng?: number | null;
  activeTcId?: string | null;
}

export type RideStatus = 'PENDING'|'ASSIGNED'|'EN_ROUTE'|'PICKED_UP'|'DROPPED'|'CANCELED';

export interface Ride {
  id: string;
  rideCode: number;
  status: RideStatus;
  requestedAt: string;
  pickupAddr: string;
  dropAddr: string;
  passengers: number;
  rider?: { firstName?: string; lastName?: string; phone?: string };
  vanId?: string | null;
  rating?: number | null;
}
