export type StudentStream = 'JEE' | 'NEET';

const STREAM_KEY = 'prepmind_stream';

export const STREAM_SUBJECTS: Record<StudentStream, string[]> = {
  JEE:  ['Physics', 'Chemistry', 'Mathematics'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
};

// Distinct hues per subject — Physics (blue) and Chemistry (orange) kept far
// apart so they never look alike on charts and cards (5c).
export const STREAM_COLORS: Record<string, string> = {
  Physics:     '#2563EB',
  Chemistry:   '#F97316',
  Mathematics: '#10B981',
  Biology:     '#8B5CF6',
};

export const STREAM_BG: Record<string, string> = {
  Physics:     'rgba(37,99,235,0.10)',
  Chemistry:   'rgba(249,115,22,0.10)',
  Mathematics: 'rgba(16,185,129,0.10)',
  Biology:     'rgba(139,92,246,0.10)',
};

export function getStudentStream(): StudentStream | null {
  try {
    const val = localStorage.getItem(STREAM_KEY);
    if (val === 'JEE' || val === 'NEET') return val;
    return null;
  } catch {
    return null;
  }
}

export function saveStreamLocal(stream: StudentStream): void {
  localStorage.setItem(STREAM_KEY, stream);
}

export function clearStudentStream(): void {
  localStorage.removeItem(STREAM_KEY);
}

export function getStreamSubjects(stream?: StudentStream | null): string[] {
  return [...(STREAM_SUBJECTS[stream ?? 'JEE'])];
}

export function getThirdSubject(stream?: StudentStream | null): string {
  return stream === 'NEET' ? 'Biology' : 'Mathematics';
}
