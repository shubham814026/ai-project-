/**
 * Studio Snapshot Types
 * Data structures for auto-shutter headshots and session audits.
 */

export interface StudioSnapshot {
  id: string;
  dataUrl: string;
  timestamp: number;
  poseName: string;
  poseCategory: string;
  framingScore: number;
  poseScore: number;
  overallScore: number;
  shotScale: string;
  metrics: {
    headroomPercent: number;
    centeringPercent: number;
    symmetryPercent: number;
  };
}
