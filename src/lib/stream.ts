export type StudentStream = 'JEE' | 'NEET';

const STREAM_KEY = 'prepmind_stream';

export const STREAM_SUBJECTS: Record<StudentStream, string[]> = {
  JEE:  ['Physics', 'Chemistry', 'Mathematics'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
};

export const STREAM_EXAM: Record<StudentStream, string> = {
  JEE:  'JEE 2025',
  NEET: 'NEET 2025',
};

export const STREAM_COLORS: Record<string, string> = {
  Physics:     '#5B4FE8',
  Chemistry:   '#8B5CF6',
  Mathematics: '#10B981',
  Biology:     '#14B8A6',
};

export const STREAM_BG: Record<string, string> = {
  Physics:     'rgba(91,79,232,0.10)',
  Chemistry:   'rgba(139,92,246,0.10)',
  Mathematics: 'rgba(16,185,129,0.10)',
  Biology:     'rgba(20,184,166,0.10)',
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
