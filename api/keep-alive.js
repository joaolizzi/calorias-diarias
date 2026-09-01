import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Método não permitido' });
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ ok: false, error: 'Supabase não configurado no servidor' });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { enabled: false },
    });

    // Consulta leve à tabela profiles para gerar atividade legítima no banco.
    const { error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) throw error;

    return res.status(200).json({
      ok: true,
      message: 'Supabase ativo',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[keep-alive] error', error);
    return res.status(500).json({
      ok: false,
      error: error?.message || 'Falha ao acessar o Supabase',
    });
  }
}
