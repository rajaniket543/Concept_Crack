import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { pool, withTransaction } from './client';
import {
  demoAccounts,
  rolePermissions,
  seed,
  seedQuestions,
  userDirectory,
} from '../server/seed';
import { currentStudent, leaderboard, analysis } from '../src/mocks/student';
import { institutes as instituteRows, parentMetrics, facultyMetrics, adminMetrics } from '../src/mocks/portal';

type RoleKey = keyof typeof rolePermissions;

function hash(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function truncateAll(client: Awaited<ReturnType<typeof pool.connect>>) {
  await client.query(`
    TRUNCATE TABLE
      leaderboard_snapshots,
      audit_logs,
      notifications,
      attendance_records,
      scores,
      attempt_answers,
      attempts,
      test_questions,
      tests,
      questions,
      otp_challenges,
      password_reset_tokens,
      auth_sessions,
      user_roles,
      users,
      batches,
      chapters,
      subjects,
      institutes,
      roles
    RESTART IDENTITY CASCADE;
  `);
}

async function seedRoles(client: Awaited<ReturnType<typeof pool.connect>>) {
  await client.query(
    `
    INSERT INTO roles (key, label, description)
    VALUES
      ('student', 'Student', 'Learner portal access'),
      ('parent', 'Parent', 'Read-only progress visibility'),
      ('faculty', 'Faculty', 'Batch and question-bank management'),
      ('admin', 'Admin', 'Platform-level control')
    ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description;
  `,
  );
}

async function seedInstitutes(client: Awaited<ReturnType<typeof pool.connect>>) {
  for (const item of instituteRows) {
    await client.query(
      `
      INSERT INTO institutes (name, region, plan, status)
      VALUES ($1, $2, $3, 'Active')
      ON CONFLICT (name) DO UPDATE
        SET region = EXCLUDED.region,
            plan = EXCLUDED.plan,
            status = EXCLUDED.status,
            updated_at = now();
    `,
      [item.name, item.region, item.plan],
    );
  }
}

async function seedBatches(client: Awaited<ReturnType<typeof pool.connect>>) {
  const instituteMap = new Map<string, string>();
  const institutesResult = await client.query<{ id: string; name: string }>('SELECT id, name FROM institutes');
  for (const row of institutesResult.rows) instituteMap.set(row.name, row.id);

  const batchSeed = [
    { institute: 'Delta Learning', name: 'A-12', grade_level: 'Grade 12', stream: 'Science' },
    { institute: 'NorthStar Academy', name: 'A-11', grade_level: 'Grade 11', stream: 'Science' },
    { institute: 'BluePeak Coaching', name: 'B-12', grade_level: 'Grade 12', stream: 'Science' },
    { institute: 'Summit Institute', name: 'C-12', grade_level: 'Grade 12', stream: 'Science' },
  ];

  for (const batch of batchSeed) {
    await client.query(
      `
      INSERT INTO batches (institute_id, name, grade_level, stream, status)
      VALUES ($1, $2, $3, $4, 'Active')
      ON CONFLICT (institute_id, name) DO UPDATE
        SET grade_level = EXCLUDED.grade_level,
            stream = EXCLUDED.stream,
            status = EXCLUDED.status,
            updated_at = now();
    `,
      [instituteMap.get(batch.institute), batch.name, batch.grade_level, batch.stream],
    );
  }
}

async function seedSubjectsAndChapters(client: Awaited<ReturnType<typeof pool.connect>>) {
  const subjects = [
    { name: 'Mathematics', code: 'MATH' },
    { name: 'Physics', code: 'PHYS' },
    { name: 'Chemistry', code: 'CHEM' },
    { name: 'English', code: 'ENG' },
    { name: 'Biology', code: 'BIO' },
    { name: 'Psychology', code: 'PSY' },
  ];

  for (const subject of subjects) {
    await client.query(
      `
      INSERT INTO subjects (name, code)
      VALUES ($1, $2)
      ON CONFLICT (name) DO UPDATE SET code = EXCLUDED.code;
    `,
      [subject.name, subject.code],
    );
  }

  const subjectIds = new Map<string, string>();
  const subjectRows = await client.query<{ id: string; name: string }>('SELECT id, name FROM subjects');
  for (const row of subjectRows.rows) subjectIds.set(row.name, row.id);

  const chapterSeeds: Record<string, string[]> = {
    Mathematics: ['Algebra', 'Calculus', 'Probability', 'Vectors'],
    Physics: ['Mechanics', 'Electrostatics', 'Optics', 'Thermodynamics'],
    Chemistry: ['Organic Synthesis', 'Chemical Bonding', 'Inorganic Chemistry'],
    English: ['Reading Comprehension', 'Grammar', 'Vocabulary'],
    Biology: ['Genetics', 'Ecology', 'Cell Biology'],
    Psychology: ['Memory', 'Learning Theory', 'Cognitive Bias', 'Perception', 'Social Cognition', 'Biological Bases'],
  };

  for (const [subjectName, chapters] of Object.entries(chapterSeeds)) {
    const subjectId = subjectIds.get(subjectName);
    if (!subjectId) continue;
    for (let index = 0; index < chapters.length; index += 1) {
      const name = chapters[index];
      await client.query(
        `
        INSERT INTO chapters (subject_id, name, order_index)
        VALUES ($1, $2, $3)
        ON CONFLICT (subject_id, name) DO UPDATE SET order_index = EXCLUDED.order_index;
      `,
        [subjectId, name, index + 1],
      );
    }
  }
}

async function seedUsers(client: Awaited<ReturnType<typeof pool.connect>>) {
  const instituteRowsResult = await client.query<{ id: string; name: string }>('SELECT id, name FROM institutes');
  const instituteMap = new Map(instituteRowsResult.rows.map((row) => [row.name, row.id]));

  const batchRowsResult = await client.query<{ id: string; name: string }>('SELECT id, name FROM batches');
  const batchMap = new Map(batchRowsResult.rows.map((row) => [row.name, row.id]));

  const rowMap = new Map<string, typeof demoAccounts[number]>();
  for (const account of demoAccounts) rowMap.set(account.email, account);

  const seedUsers = [
    ...demoAccounts,
    ...userDirectory.map((entry) => ({
      id: entry.id,
      name: entry.name,
      role: 'student' as const,
      email: entry.email,
      mobile: entry.mobile,
      status: entry.status,
      lastActive: entry.lastActive,
      institute: entry.institute,
      batch: entry.batch,
      passwordSalt: rowMap.get('student@prepmind.ai')!.passwordSalt,
      passwordHash: rowMap.get('student@prepmind.ai')!.passwordHash,
      permissions: rolePermissions.student,
    })),
  ].filter((user, index, arr) => arr.findIndex((candidate) => candidate.email === user.email) === index);

  for (const user of seedUsers) {
    const instituteId =
      user.role === 'faculty'
        ? instituteMap.get('NorthStar Academy')
        : user.role === 'parent'
          ? instituteMap.get('Delta Learning')
          : user.role === 'admin'
            ? instituteMap.get('Summit Institute')
            : instituteMap.get((user as { institute?: string }).institute ?? 'NorthStar Academy');
    const batchId =
      user.role === 'student'
        ? batchMap.get((user as { batch?: string }).batch ?? 'A-12')
        : null;

    await client.query(
      `
      INSERT INTO users (id, name, email, mobile, password_salt, password_hash, status, last_active_at, institute_id, batch_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        email = EXCLUDED.email,
        mobile = EXCLUDED.mobile,
        password_salt = EXCLUDED.password_salt,
        password_hash = EXCLUDED.password_hash,
        status = EXCLUDED.status,
        last_active_at = EXCLUDED.last_active_at,
        institute_id = EXCLUDED.institute_id,
        batch_id = EXCLUDED.batch_id,
        updated_at = now();
    `,
      [user.id, user.name, user.email, user.mobile, user.passwordSalt, user.passwordHash, user.status, instituteId, batchId],
    );

    await client.query(
      `
      INSERT INTO user_roles (user_id, role_key)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING;
    `,
      [user.id, user.role],
    );
  }
}

async function seedQuestionsAndTests(client: Awaited<ReturnType<typeof pool.connect>>) {
  const subjectRows = await client.query<{ id: string; name: string }>('SELECT id, name FROM subjects');
  const chapterRows = await client.query<{ id: string; subject_id: string; name: string }>('SELECT id, subject_id, name FROM chapters');
  const subjectMap = new Map(subjectRows.rows.map((row) => [row.name, row.id]));
  const chapterMap = new Map<string, string>();
  for (const row of chapterRows.rows) {
    chapterMap.set(`${row.subject_id}:${row.name}`, row.id);
  }

  const psychologySubjectId = subjectMap.get('Psychology')!;
  const chapterBySection = new Map<string, string>([
    ['Section A: Memory', 'Memory'],
    ['Section A: Learning Theory', 'Learning Theory'],
    ['Section A: Research Methods', 'Memory'],
    ['Section B: Cognitive Bias', 'Cognitive Bias'],
    ['Section C: Perception', 'Perception'],
    ['Section D: Social Cognition', 'Social Cognition'],
    ['Section E: Biological Bases', 'Biological Bases'],
  ]);

  const questionIdMap = new Map<number, string>();
  for (const question of seedQuestions) {
    const chapterName = chapterBySection.get(question.section) ?? 'Memory';
    const chapterId = chapterMap.get(`${psychologySubjectId}:${chapterName}`);
    const result = await client.query<{ id: string }>(
      `
      INSERT INTO questions (
        public_id, subject_id, chapter_id, source, difficulty, question_type,
        prompt, option_a, option_b, option_c, option_d, correct_option, explanation, tags
      )
      VALUES ($1, $2, $3, 'seed', $4, 'MCQ', $5, $6, $7, $8, $9, $10, '', $11::jsonb)
      ON CONFLICT (public_id) DO UPDATE SET
        subject_id = EXCLUDED.subject_id,
        chapter_id = EXCLUDED.chapter_id,
        source = EXCLUDED.source,
        difficulty = EXCLUDED.difficulty,
        question_type = EXCLUDED.question_type,
        prompt = EXCLUDED.prompt,
        option_a = EXCLUDED.option_a,
        option_b = EXCLUDED.option_b,
        option_c = EXCLUDED.option_c,
        option_d = EXCLUDED.option_d,
        correct_option = EXCLUDED.correct_option,
        explanation = EXCLUDED.explanation,
        tags = EXCLUDED.tags,
        updated_at = now()
      RETURNING id;
    `,
      [
        question.id,
        psychologySubjectId,
        chapterId ?? null,
        question.difficulty,
        question.prompt,
        question.options[0].text,
        question.options[1].text,
        question.options[2].text,
        question.options[3].text,
        question.correctKey,
        JSON.stringify([question.section]),
      ],
    );
    if (result.rows[0]) {
      questionIdMap.set(question.id, result.rows[0].id);
    } else {
      const existing = await client.query<{ id: string }>('SELECT id FROM questions WHERE prompt = $1 LIMIT 1', [question.prompt]);
      if (existing.rows[0]) questionIdMap.set(question.id, existing.rows[0].id);
    }
  }

  const testInsert = await client.query<{ id: string }>(
    `
    INSERT INTO tests (code, title, test_type, batch_id, duration_seconds, total_questions, status, created_by)
    VALUES (
      'PM-992-AX',
      $1,
      'Mock',
      (SELECT id FROM batches ORDER BY created_at ASC LIMIT 1),
      $2,
      $3,
      'Published',
      (SELECT id FROM users WHERE email = 'faculty@prepmind.ai' LIMIT 1)
    )
    ON CONFLICT (code) DO UPDATE SET
      title = EXCLUDED.title,
      test_type = EXCLUDED.test_type,
      duration_seconds = EXCLUDED.duration_seconds,
      total_questions = EXCLUDED.total_questions,
      status = EXCLUDED.status
    RETURNING id;
  `,
    [seed.examMeta.title, seed.examMeta.durationSeconds, seed.examMeta.totalQuestions],
  );
  const testId = testInsert.rows[0].id;

  await client.query('DELETE FROM test_questions WHERE test_id = $1', [testId]);
  for (let index = 0; index < seedQuestions.length; index += 1) {
    const question = seedQuestions[index];
    const questionId = questionIdMap.get(question.id);
    if (!questionId) continue;
    await client.query(
      `
      INSERT INTO test_questions (test_id, question_id, question_order)
      VALUES ($1, $2, $3)
      ON CONFLICT (test_id, question_id) DO UPDATE SET question_order = EXCLUDED.question_order;
    `,
      [testId, questionId, index + 1],
    );
  }
}

async function seedAttemptData(client: Awaited<ReturnType<typeof pool.connect>>) {
  const student = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1 LIMIT 1', ['student@prepmind.ai']);
  const test = await client.query<{ id: string }>('SELECT id FROM tests WHERE code = $1 LIMIT 1', ['PM-992-AX']);
  const questionRows = await client.query<{ id: string; prompt: string; correct_option: string }>(
    'SELECT id, prompt, correct_option FROM questions ORDER BY created_at ASC',
  );

  if (!student.rows[0] || !test.rows[0]) return;

  const attempt = await client.query<{ id: string }>(
    `
    INSERT INTO attempts (test_id, user_id, status, started_at, submitted_at, time_taken_seconds, client_meta, lock_token)
    VALUES ($1, $2, 'submitted', now() - interval '42 minutes', now(), 2520, $3::jsonb, $4)
    ON CONFLICT DO NOTHING
    RETURNING id;
  `,
    [test.rows[0].id, student.rows[0].id, JSON.stringify({ browser: 'Chrome', device: 'desktop' }), hash('lock-1')],
  );

  let attemptId = attempt.rows[0]?.id;
  if (!attemptId) {
    const existing = await client.query<{ id: string }>('SELECT id FROM attempts WHERE user_id = $1 AND test_id = $2 LIMIT 1', [
      student.rows[0].id,
      test.rows[0].id,
    ]);
    attemptId = existing.rows[0]?.id;
  }
  if (!attemptId) return;

  await client.query('DELETE FROM attempt_answers WHERE attempt_id = $1', [attemptId]);

  const correctSet = new Set(questionRows.rows.slice(0, 44).map((row) => row.id));
  const wrongSet = new Set(questionRows.rows.slice(44, 48).map((row) => row.id));

  for (const question of questionRows.rows) {
    if (correctSet.has(question.id)) {
      await client.query(
        `
        INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_marked, answered_at)
        VALUES ($1, $2, $3, false, now())
        ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_option = EXCLUDED.selected_option;
      `,
        [attemptId, question.id, question.correct_option],
      );
    } else if (wrongSet.has(question.id)) {
      const wrongOption = ['A', 'B', 'C', 'D'].find((opt) => opt !== question.correct_option)!;
      await client.query(
        `
        INSERT INTO attempt_answers (attempt_id, question_id, selected_option, is_marked, answered_at)
        VALUES ($1, $2, $3, false, now())
        ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_option = EXCLUDED.selected_option;
      `,
        [attemptId, question.id, wrongOption],
      );
    }
  }

  await client.query(
    `
    INSERT INTO scores (
      attempt_id, total_score, total_possible, correct_count, incorrect_count,
      skipped_count, accuracy_pct, rank_in_batch, percentile, computed_at
    )
    VALUES ($1, 150, 200, 44, 4, 2, 88, 42, 5, now())
    ON CONFLICT (attempt_id) DO UPDATE SET
      total_score = EXCLUDED.total_score,
      total_possible = EXCLUDED.total_possible,
      correct_count = EXCLUDED.correct_count,
      incorrect_count = EXCLUDED.incorrect_count,
      skipped_count = EXCLUDED.skipped_count,
      accuracy_pct = EXCLUDED.accuracy_pct,
      rank_in_batch = EXCLUDED.rank_in_batch,
      percentile = EXCLUDED.percentile,
      computed_at = EXCLUDED.computed_at;
  `,
    [attemptId],
  );

  // Seed a short run of prior attempts so the weekly trend chart shows real
  // progress and the "vs previous attempt" delta is meaningful. These only need
  // a score row (the per-question breakdown uses the latest attempt above).
  await client.query(
    `DELETE FROM attempts WHERE user_id = $1 AND test_id = $2 AND id <> $3`,
    [student.rows[0].id, test.rows[0].id, attemptId],
  );
  const history = [
    { daysAgo: 6, accuracy: 71, score: 121, timeTaken: 2880 },
    { daysAgo: 5, accuracy: 74, score: 126, timeTaken: 2760 },
    { daysAgo: 4, accuracy: 79, score: 134, timeTaken: 2700 },
    { daysAgo: 3, accuracy: 82, score: 139, timeTaken: 2640 },
    { daysAgo: 2, accuracy: 85, score: 144, timeTaken: 2580 },
    { daysAgo: 1, accuracy: 86, score: 146, timeTaken: 2550 },
  ];
  for (const [index, h] of history.entries()) {
    const histAttempt = await client.query<{ id: string }>(
      `
      INSERT INTO attempts (test_id, user_id, status, started_at, submitted_at, time_taken_seconds, client_meta, lock_token)
      VALUES ($1, $2, 'submitted', now() - ($3 || ' days')::interval, now() - ($3 || ' days')::interval, $4, '{}'::jsonb, $5)
      RETURNING id;
    `,
      [test.rows[0].id, student.rows[0].id, h.daysAgo, h.timeTaken, hash(`hist-${index}`)],
    );
    const correct = Math.round((h.accuracy / 100) * 48);
    await client.query(
      `
      INSERT INTO scores (attempt_id, total_score, total_possible, correct_count, incorrect_count, skipped_count, accuracy_pct, rank_in_batch, percentile, computed_at)
      VALUES ($1, $2, 200, $3, $4, $5, $6, 42, 5, now() - ($7 || ' days')::interval);
    `,
      [histAttempt.rows[0].id, h.score, correct, 48 - correct, 2, h.accuracy, h.daysAgo],
    );
  }

  await client.query('DELETE FROM leaderboard_snapshots WHERE user_id = $1', [student.rows[0].id]);
  await client.query(
    `
    INSERT INTO leaderboard_snapshots (batch_id, subject_id, user_id, rank, points, accuracy_pct, snapshot_key)
    VALUES (
      (SELECT batch_id FROM users WHERE id = $1),
      (SELECT id FROM subjects WHERE name = 'Psychology' LIMIT 1),
      $1,
      42,
      2150,
      88,
      'current'
    );
  `,
    [student.rows[0].id],
  );
}

async function seedSupportTables(client: Awaited<ReturnType<typeof pool.connect>>) {
  const student = await client.query<{ id: string; batch_id: string | null }>('SELECT id, batch_id FROM users WHERE email = $1 LIMIT 1', [
    'student@prepmind.ai',
  ]);
  if (student.rows[0]?.batch_id) {
    await client.query(
      `
      INSERT INTO attendance_records (user_id, batch_id, session_date, status, source)
      VALUES ($1, $2, CURRENT_DATE, 'Present', 'seed')
      ON CONFLICT (user_id, session_date) DO UPDATE SET status = EXCLUDED.status, source = EXCLUDED.source;
    `,
      [student.rows[0].id, student.rows[0].batch_id],
    );
  }

  await client.query('DELETE FROM notifications');
  await client.query(
    `
    INSERT INTO notifications (user_id, role_key, title, body, channel, status, scheduled_for, sent_at)
    VALUES
      ((SELECT id FROM users WHERE email = 'student@prepmind.ai' LIMIT 1), 'student', 'Exam submitted', 'Your mock result is ready.', 'in_app', 'sent', now(), now()),
      (NULL, 'parent', 'Weekly report', 'The weekly academic summary is available.', 'email', 'queued', now() + interval '1 hour', NULL),
      (NULL, 'faculty', 'Intervention alert', 'Three students need follow-up support.', 'in_app', 'queued', now() + interval '2 hours', NULL)
    ON CONFLICT DO NOTHING;
  `,
  );

  await client.query('DELETE FROM audit_logs');
  await client.query(
    `
    INSERT INTO audit_logs (actor_user_id, actor_role_key, action, detail, severity, metadata)
    VALUES
      ((SELECT id FROM users WHERE email = 'admin@prepmind.ai' LIMIT 1), 'admin', 'seed_complete', 'Initial platform seed loaded', 'info', '{"origin":"seed"}'::jsonb),
      ((SELECT id FROM users WHERE email = 'student@prepmind.ai' LIMIT 1), 'student', 'exam_submitted', 'Student mock exam submitted', 'info', '{"test":"PM-992-AX"}'::jsonb)
    ON CONFLICT DO NOTHING;
  `,
  );
}

async function seedPortalAggregation(client: Awaited<ReturnType<typeof pool.connect>>) {
  const parent = parentMetrics[0];
  const faculty = facultyMetrics[0];
  const admin = adminMetrics[0];
  await client.query(
    `
    INSERT INTO notifications (role_key, title, body, channel, status)
    VALUES ($1, $2, $3, 'in_app', 'queued')
    ON CONFLICT DO NOTHING;
  `,
    ['admin', `KPIs seeded: ${admin.value}`, `Parent metric: ${parent.value}, Faculty metric: ${faculty.value}`],
  );
}

export async function seedDatabase() {
  await withTransaction(async (client) => {
    await truncateAll(client);
    await seedRoles(client);
    await seedInstitutes(client);
    await seedBatches(client);
    await seedSubjectsAndChapters(client);
    await seedUsers(client);
    await seedQuestionsAndTests(client);
    await seedAttemptData(client);
    await seedSupportTables(client);
    await seedPortalAggregation(client);
  });
  console.log('Database seeded.');
}

async function main() {
  await seedDatabase();
  await pool.end();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(async (error) => {
    console.error(error);
    await pool.end().catch(() => undefined);
    process.exit(1);
  });
}
