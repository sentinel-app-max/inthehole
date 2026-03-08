import type { HoleCoordinate } from "@/types";

/**
 * Jackal Creek Golf Estate — surveyed hole coordinates.
 * Par & SI from official Pocket Caddi course guide.
 * All 18 holes mapped.
 */
const JACKAL_CREEK_HOLES: HoleCoordinate[] = [
  {
    hole: 1,
    par: 5,
    si: 2,
    tee: { lat: -26.062614, lng: 27.919354 },
    green: { lat: -26.060481, lng: 27.924228 },
    dogleg: { lat: -26.061298, lng: 27.923700 },
  },
  {
    hole: 2,
    par: 4,
    si: 6,
    tee: { lat: -26.059256, lng: 27.923854 },
    green: { lat: -26.057241, lng: 27.920710 },
    dogleg: { lat: -26.057967, lng: 27.922718 },
  },
  {
    hole: 3,
    par: 3,
    si: 10,
    tee: { lat: -26.056814, lng: 27.920301 },
    green: { lat: -26.055894, lng: 27.918962 },
  },
  {
    hole: 4,
    par: 4,
    si: 4,
    tee: { lat: -26.056717, lng: 27.920441 },
    green: { lat: -26.056345, lng: 27.924132 },
    dogleg: { lat: -26.056861, lng: 27.923038 },
  },
  {
    hole: 5,
    par: 4,
    si: 8,
    tee: { lat: -26.055127, lng: 27.924402 },
    green: { lat: -26.052409, lng: 27.922233 },
    dogleg: { lat: -26.053058, lng: 27.923126 },
  },
  {
    hole: 6,
    par: 5,
    si: 16,
    tee: { lat: -26.052561, lng: 27.921764 },
    green: { lat: -26.050184, lng: 27.917878 },
    dogleg: { lat: -26.051750, lng: 27.919641 },
  },
  {
    hole: 7,
    par: 3,
    si: 12,
    tee: { lat: -26.052682, lng: 27.916929 },
    green: { lat: -26.053366, lng: 27.915824 },
  },
  {
    hole: 8,
    par: 4,
    si: 14,
    tee: { lat: -26.053909, lng: 27.916150 },
    green: { lat: -26.056779, lng: 27.915389 },
    dogleg: { lat: -26.055476, lng: 27.915832 },
  },
  {
    hole: 9,
    par: 5,
    si: 18,
    tee: { lat: -26.057991, lng: 27.915161 },
    green: { lat: -26.060376, lng: 27.917839 },
    dogleg: { lat: -26.059865, lng: 27.916430 },
  },
  {
    hole: 10,
    par: 4,
    si: 17,
    tee: { lat: -26.054810, lng: 27.918191 },
    green: { lat: -26.051888, lng: 27.917314 },
  },
  {
    hole: 11,
    par: 4,
    si: 15,
    tee: { lat: -26.057155, lng: 27.914650 },
    green: { lat: -26.053836, lng: 27.915592 },
    dogleg: { lat: -26.054822, lng: 27.915094 },
  },
  {
    hole: 12,
    par: 3,
    si: 7,
    tee: { lat: -26.054379, lng: 27.916190 },
    green: { lat: -26.056744, lng: 27.915398 },
  },
  {
    hole: 13,
    par: 4,
    si: 13,
    tee: { lat: -26.057582, lng: 27.914815 },
    green: { lat: -26.060385, lng: 27.917844 },
    dogleg: { lat: -26.059713, lng: 27.916245 },
  },
  {
    hole: 14,
    par: 4,
    si: 1,
    tee: { lat: -26.051612, lng: 27.917668 },
    green: { lat: -26.054497, lng: 27.918513 },
  },
  {
    hole: 15,
    par: 3,
    si: 5,
    tee: { lat: -26.052446, lng: 27.918691 },
    green: { lat: -26.051211, lng: 27.918072 },
  },
  {
    hole: 16,
    par: 4,
    si: 11,
    tee: { lat: -26.052123, lng: 27.918998 },
    green: { lat: -26.054850, lng: 27.919414 },
  },
  {
    hole: 17,
    par: 4,
    si: 9,
    tee: { lat: -26.055528, lng: 27.917950 },
    green: { lat: -26.057506, lng: 27.920098 },
  },
  {
    hole: 18,
    par: 5,
    si: 3,
    tee: { lat: -26.057940, lng: 27.920280 },
    green: { lat: -26.062156, lng: 27.918901 },
    dogleg: { lat: -26.060283, lng: 27.920649 },
  },
];

export default JACKAL_CREEK_HOLES;
