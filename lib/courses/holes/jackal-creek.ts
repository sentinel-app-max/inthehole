import type { HoleCoordinate } from "@/types";

/**
 * Jackal Creek Golf Estate — surveyed hole coordinates.
 * Holes 8, 9, 15, 16 not yet mapped.
 */
const JACKAL_CREEK_HOLES: HoleCoordinate[] = [
  {
    hole: 1,
    tee: { lat: -26.062616, lng: 27.919353 },
    green: { lat: -26.060496, lng: 27.924248 },
  },
  {
    hole: 2,
    tee: { lat: -26.059256, lng: 27.923854 },
    green: { lat: -26.057241, lng: 27.920710 },
  },
  {
    hole: 3,
    tee: { lat: -26.056091, lng: 27.919948 },
    green: { lat: -26.055901, lng: 27.918996 },
  },
  {
    hole: 4,
    tee: { lat: -26.056663, lng: 27.920572 },
    green: { lat: -26.056338, lng: 27.924135 },
  },
  {
    hole: 5,
    tee: { lat: -26.055079, lng: 27.924404 },
    green: { lat: -26.052408, lng: 27.922241 },
    dogleg: { lat: -26.053060, lng: 27.923120 },
  },
  {
    hole: 6,
    tee: { lat: -26.052561, lng: 27.921764 },
    green: { lat: -26.050184, lng: 27.917878 },
  },
  {
    hole: 7,
    tee: { lat: -26.051595, lng: 27.917654 },
    green: { lat: -26.054484, lng: 27.918514 },
  },
  {
    hole: 10,
    tee: { lat: -26.054810, lng: 27.918191 },
    green: { lat: -26.051888, lng: 27.917314 },
  },
  {
    hole: 11,
    tee: { lat: -26.053050, lng: 27.917110 },
    green: { lat: -26.053395, lng: 27.915945 },
  },
  {
    hole: 12,
    tee: { lat: -26.054379, lng: 27.916190 },
    green: { lat: -26.056744, lng: 27.915398 },
  },
  {
    hole: 13,
    tee: { lat: -26.057582, lng: 27.914815 },
    green: { lat: -26.060385, lng: 27.917844 },
    dogleg: { lat: -26.059713, lng: 27.916245 },
  },
  {
    hole: 14,
    tee: { lat: -26.059254, lng: 27.923852 },
    green: { lat: -26.057270, lng: 27.920677 },
  },
  {
    hole: 17,
    tee: { lat: -26.055528, lng: 27.917950 },
    green: { lat: -26.057506, lng: 27.920098 },
  },
  {
    hole: 18,
    tee: { lat: -26.058372, lng: 27.920416 },
    green: { lat: -26.062160, lng: 27.918907 },
    dogleg: { lat: -26.060411, lng: 27.920615 },
  },
];

export default JACKAL_CREEK_HOLES;
