import type { HoleCoordinate } from "@/types";
import JACKAL_CREEK_HOLES from "./jackal-creek";

const HOLE_DATA: Record<string, HoleCoordinate[]> = {
  "jackal-creek": JACKAL_CREEK_HOLES,
};

export function getHoleCoordinates(courseId: string): HoleCoordinate[] | null {
  return HOLE_DATA[courseId] ?? null;
}

export function hasHoleCoordinates(courseId: string): boolean {
  return courseId in HOLE_DATA;
}
