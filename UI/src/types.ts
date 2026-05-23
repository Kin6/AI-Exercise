export type Tab = "today" | "archive" | "mine";

export interface DiscomfortFeel {
  id: string;
  label: string;
  icon: string;
}

export interface DiscomfortArea {
  id: string;
  label: string;
  x: number; // Percent relative to SVG body
  y: number;
}

export interface HistoryRecord {
  date: string;
  feeling: string;
  mechanisms: string[];
  muscles: string[];
  relieved: string;
  cameraObs?: string;
  score: number; // 0-10
}

export interface MuscleInfo {
  name: string;
  position: string;
  issue: string;
  feeling: string;
}

export interface RoutineStep {
  step: number;
  type: "relax" | "activate" | "check";
  name: string;
  duration: string;
  focus: string;
  svgIcon: string;
}

export interface DiagnosisData {
  diagnosis: string;
  mechanisms: string[];
  muscles: MuscleInfo[];
  routine: RoutineStep[];
}
