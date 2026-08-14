import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();

function send(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Método não permitido' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_EMAIL) {
    return send(res, 500, { ok: false, error: 'Admin não configurado no servidor' });
  }

  const auth = String(req.headers.authorization || '');
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return send(res, 401, { ok: false, error: 'Token ausente' });

  const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { enabled: false },
  });
  const { data: authData, error: authError } = await publicClient.auth.getUser(match[1]);
  if (authError || !authData?.user) return send(res, 401, { ok: false, error: 'Sessão inválida' });

  const email = String(authData.user.email || '').toLowerCase();
  if (!email || email !== ADMIN_EMAIL) return send(res, 403, { ok: false, error: 'Acesso administrativo negado' });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { enabled: false },
  });

  try {
    const [{ data: profiles, error: profilesError }, { data: usersData, error: usersError }] = await Promise.all([
      admin.from('profiles').select('id, display_name, weight_kg, height_cm, age, sex, activity_level, goal, daily_kcal_goal, daily_water_goal_ml, onboarding_complete, created_at').order('created_at', { ascending: false }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    if (profilesError) throw profilesError;
    if (usersError) throw usersError;

    const users = usersData?.users || [];
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    const merged = users.map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      ...profileById.get(user.id),
    }));

    const onboarded = merged.filter((user) => user.onboarding_complete).length;
    const avg = (values) => {
      const valid = values.map(Number).filter(Number.isFinite);
      return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : 0;
    };

    const goalCounts = merged.reduce((acc, user) => {
      const goal = user.goal || 'not_set';
      acc[goal] = (acc[goal] || 0) + 1;
      return acc;
    }, {});

    return send(res, 200, {
      ok: true,
      data: {
        totalUsers: merged.length,
        onboardedUsers: onboarded,
        pendingSetup: merged.length - onboarded,
        averageWeightKg: avg(merged.map((u) => u.weight_kg)),
        averageKcalGoal: avg(merged.map((u) => u.daily_kcal_goal)),
        averageWaterGoal: avg(merged.map((u) => u.daily_water_goal_ml)),
        goalCounts,
        users: merged.slice(0, 100),
      },
    });
  } catch (error) {
    console.error('[admin] overview error', error);
    return send(res, 500, { ok: false, error: error?.message || 'Falha ao carregar visão administrativa' });
  }
}
