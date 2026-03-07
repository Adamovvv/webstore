import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || ''
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-client-ip') ||
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('fastly-client-ip') ||
    ''
  )
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const ipSalt = Deno.env.get('REVIEW_IP_SALT')
  if (!supabaseUrl || !serviceRoleKey || !ipSalt) {
    return jsonResponse({ error: 'missing_env' }, 500)
  }

  const ip = getClientIp(request)
  if (!ip) {
    return jsonResponse({ error: 'ip_not_found' }, 400)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }

  const name = String(body.name || '').trim()
  const city = String(body.city || '').trim()
  const text = String(body.text || '').trim()
  const rating = Math.min(5, Math.max(1, Number(body.rating) || 5))

  if (name.length < 2 || name.length > 40) {
    return jsonResponse({ error: 'invalid_name' }, 400)
  }
  if (text.length < 8 || text.length > 2000) {
    return jsonResponse({ error: 'invalid_text' }, 400)
  }

  const ipHash = await sha256(`${ipSalt}:${ip}`)
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await adminClient
    .from('reviews')
    .insert({
      name,
      city: city || null,
      rating,
      text,
      ip_hash: ipHash,
      is_approved: true,
    })
    .select('id, name, city, rating, text, created_at')
    .single()

  if (error?.code === '23505') {
    return jsonResponse({ error: 'duplicate_ip' }, 409)
  }
  if (error) {
    return jsonResponse({ error: 'insert_failed', code: error.code, details: error.message }, 500)
  }

  return jsonResponse({ review: data }, 200)
})
