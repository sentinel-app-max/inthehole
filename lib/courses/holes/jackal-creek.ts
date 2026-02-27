import type { HoleCoordinate } from "@/types";

/**
 * Jackal Creek Golf Estate — hole coordinates (tee box + green centre).
 * Hole 1 has placeholder coordinates — replace with surveyed GPS data.
 */
const JACKAL_CREEK_HOLES: HoleCoordinate[] = [
  {
    hole: 1,
    tee: { lat: -26.0567, lng: 27.9206 },
    green: { lat: -26.0520, lng: 27.9210 },
  },
];

export default JACKAL_CREEK_HOLES;
