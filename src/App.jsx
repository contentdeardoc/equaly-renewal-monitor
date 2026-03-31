import { useState, useEffect } from 'react'

// ── Status config ──────────────────────────────────────────────
const STATUS = {
  EXPIRED:  { label:'Expired',    color:'#A32D2D', bg:'#FCEBEB', border:'#F09595' },
  CRITICAL: { label:'1–7 days',   color:'#854F0B', bg:'#FAEEDA', border:'#FAC775' },
  WARNING:  { label:'8–30 days',  color:'#185FA5', bg:'#E6F1FB', border:'#85B7EB' },
  ACTIVE:   { label:'Active',     color:'#3B6D11', bg:'#EAF3DE', border:'#97C459' },
  UNKNOWN:  { label:'No date',    color:'#5F5E5A', bg:'#F1EFE8', border:'#B4B2A9' },
}

function daysUntil(d) {
  if (!d) return null
  const exp = new Date(d), now = new Date()
  now.setHours(0,0,0,0); exp.setHours(0,0,0,0)
  return Math.round((exp - now) / 86400000)
}
function getStatusKey(days) {
  if (days === null) return 'UNKNOWN'
  if (days < 0)  return 'EXPIRED'
  if (days <= 7) return 'CRITICAL'
  if (days <= 30) return 'WARNING'
  return 'ACTIVE'
}
function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })
}

// ── LocalStorage keys ──────────────────────────────────────────
const K = { cfg:'eq_cfg_v2', domains:'eq_domains_v2', notifs:'eq_notifs_v2', map:'eq_specmap_v2' }

// ── Equally API calls ──────────────────────────────────────────
async function getEquallyToken(clientId, clientSecret) {
  const res = await fetch('https://auth.prod.equally.ai/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error(`Auth failed (${res.status}) — check your Client ID and Secret`)
  return res.json()
}

async function getEquallyDomains(clientId, token, slug) {
  const query = `query getDomains($payload: Request!) {
    getDomains(payload: $payload) { data message statusCode }
  }`
  const res = await fetch('https://appsync.prod.equally.ai/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'equally-auth-provider': 'cognito',
      'equally-client-id': clientId,
    },
    body: JSON.stringify({
      query,
      variables: { payload: { payload: JSON.stringify({ slug }) } },
    }),
  })
  if (!res.ok) throw new Error(`API call failed (${res.status})`)
  const json = await res.json()
  const raw = json?.data?.getDomains?.data
  if (!raw) throw new Error(json?.data?.getDomains?.message || 'No data returned — check your Business Slug')
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
  return Array.isArray(parsed) ? parsed : (parsed?.domains || parsed?.items || [])
}

// ── Sample data ────────────────────────────────────────────────
const SAMPLE = [
  { url:'acmedental.com',         expires:'2026-04-03', archived:false, is_first_shown:true  },
  { url:'brightsmilesnyc.com',    expires:'2026-04-08', archived:false, is_first_shown:true  },
  { url:'coastalfamilydds.com',   expires:'2026-04-25', archived:false, is_first_shown:true  },
  { url:'downtowndentalarts.com', expires:'2026-05-14', archived:false, is_first_shown:false },
  { url:'eastsideoralhealth.com', expires:'2026-06-01', archived:false, is_first_shown:true  },
  { url:'familyfirstdental.com',  expires:'2026-03-18', archived:false, is_first_shown:true  },
  { url:'greenvalleydds.com',     expires:'2026-07-10', archived:false, is_first_shown:true  },
  { url:'harborviewdental.com',   expires:'2026-04-01', archived:false, is_first_shown:false },
]

// ── Styles (inline, no CSS file needed) ───────────────────────
const c = {
  page:    { fontFamily:'-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', color:'#1a1a1a', minHeight:'100vh', background:'#f8f8f6' },
  header:  { background:'#fff', borderBottom:'1px solid #e5e5e2', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 },
  tabBtn:  (active) => ({ padding:'5px 13px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', border: active?'1px solid #d0cfc8':'1px solid transparent', background: active?'#fff':'transparent', color: active?'#1a1a1a':'#6b6a65' }),
  card:    { background:'#fff', border:'1px solid #e5e5e2', borderRadius:10, overflow:'hidden' },
  statCard:(active, sk) => ({ padding:'14px 18px', borderRadius:10, cursor:'pointer', transition:'all .15s', background: active ? STATUS[sk].bg : '#fff', border:`1px solid ${active ? STATUS[sk].border : '#e5e5e2'}` }),
  input:   { width:'100%', padding:'8px 12px', borderRadius:7, border:'1px solid #e5e5e2', background:'#fff', color:'#1a1a1a', fontSize:13, boxSizing:'border-box', outline:'none' },
  btn:     (variant='blue') => {
    const map = {
      blue:  { background:'#E6F1FB', color:'#185FA5', border:'1px solid #85B7EB' },
      green: { background:'#EAF3DE', color:'#27500A', border:'1px solid #97C459' },
      gray:  { background:'#f8f8f6', color:'#6b6a65', border:'1px solid #e5e5e2' },
      red:   { background:'#FCEBEB', color:'#A32D2D', border:'1px solid #F09595' },
    }
    return { padding:'7px 15px', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer', ...map[variant] }
  },
  pill:    (sk) => ({ padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:500, background:STATUS[sk].bg, color:STATUS[sk].color, border:`1px solid ${STATUS[sk].border}` }),
  label:   { display:'block', fontSize:13, fontWeight:500, marginBottom:4, color:'#1a1a1a' },
  helper:  { fontSize:11, color:'#888780', marginTop:4 },
  toast:   (type) => ({ position:'fixed', top:14, right:14, zIndex:999, padding:'10px 18px', borderRadius:8, fontSize:13, fontWeight:500, background: type==='err'?'#FCEBEB':'#EAF3DE', color: type==='err'?'#A32D2D':'#27500A', border:`1px solid ${type==='err'?'#F09595':'#97C459'}` }),
  info:    { padding:'10px 14px', borderRadius:7, background:'#E6F1FB', color:'#0C447C', border:'1px solid #85B7EB', fontSize:12, lineHeight:1.6 },
  warn:    { padding:'10px 14px', borderRadius:7, background:'#FAEEDA', color:'#633806', border:'1px solid #FAC775', fontSize:12, lineHeight:1.6 },
  err:     { padding:'10px 14px', borderRadius:7, background:'#FCEBEB', color:'#A32D2D', border:'1px solid #F09595', fontSize:13 },
}

// ── Main component ─────────────────────────────────────────────
export default function App() {
  const [cfg, setCfg]           = useState({ clientId:'', clientSecret:'', slug:'', slackWebhook:'', alertEmail:'' })
  const [domains, setDomains]   = useState([])
  const [specMap, setSpecMap]   = useState({})
  const [notifs, setNotifs]     = useState([])
  const [tab, setTab]           = useState('dashboard')
  const [filter, setFilter]     = useState('ALL')
  const [search, setSearch]     = useState('')
  const [syncing, setSyncing]   = useState(false)
  const [syncErr, setSyncErr]   = useState('')
  const [toast, setToast]       = useState(null)
  const [cfgDirty, setCfgDirty] = useState(false)
  const [editSpec, setEditSpec] = useState(null)
  const [specInput, setSpecInput] = useState('')

  useEffect(() => {
    try {
      const saved = (key) => { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null }
      const sc = saved(K.cfg);     if (sc) setCfg(sc)
      const sd = saved(K.domains); if (sd) setDomains(sd)
      const sn = saved(K.notifs);  if (sn) setNotifs(sn)
      const sm = saved(K.map);     if (sm) setSpecMap(sm)
    } catch(e) {}
  }, [])

  const persist = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)) } catch(e) {} }

  const showToast = (msg, type='ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const addNotif = (n) => {
    const list = [{ ...n, ts: new Date().toISOString() }, ...notifs].slice(0, 100)
    setNotifs(list); persist(K.notifs, list)
  }

  const saveCfg = () => { persist(K.cfg, cfg); setCfgDirty(false); showToast('Settings saved') }

  // ── Sync ──────────────────────────────────────────────────────
  const syncNow = async () => {
    if (!cfg.clientId || !cfg.clientSecret || !cfg.slug) {
      setSyncErr('Please fill in your Client ID, Client Secret, and Business Slug.')
      return
    }
    setSyncing(true); setSyncErr('')
    try {
      const tokenRes = await getEquallyToken(cfg.clientId, cfg.clientSecret)
      if (!tokenRes.access_token) throw new Error('No token returned — check Client ID & Secret')
      const list = await getEquallyDomains(cfg.clientId, tokenRes.access_token, cfg.slug)
      if (!list.length) throw new Error('No domains returned — check your Business Slug')
      setDomains(list); persist(K.domains, list)
      addNotif({ type:'sync', msg:`Synced ${list.length} domains from Equally` })
      showToast(`✓ Synced ${list.length} domains`)
      setTab('dashboard')
    } catch(e) { setSyncErr(e.message) }
    setSyncing(false)
  }

  // ── Slack alert ───────────────────────────────────────────────
  const sendSlack = async (domain) => {
    if (!cfg.slackWebhook) { showToast('Add Slack Webhook URL in Settings first', 'err'); return }
    const days = daysUntil(domain.expires)
    const sk = getStatusKey(days)
    const emoji = { EXPIRED:'🔴', CRITICAL:'🚨', WARNING:'🔔', ACTIVE:'✅', UNKNOWN:'⚪' }[sk]
    const specialist = specMap[domain.url] || 'Unassigned'
    const daysText = days === null ? 'Unknown' : days < 0 ? 'EXPIRED ‼️' : `${days} days`
    try {
      await fetch(cfg.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text:
          `${emoji} *Equaly Renewal Alert*\n` +
          `*Domain:* ${domain.url}\n` +
          `*Status:* ${STATUS[sk].label}\n` +
          `*Expires:* ${fmtDate(domain.expires)}\n` +
          `*Days left:* ${daysText}\n` +
          `*Specialist:* ${specialist}`
        }),
      })
      addNotif({ type:'slack', account:domain.url, msg:'Slack alert sent' })
      showToast(`Slack alert sent for ${domain.url}`)
    } catch(e) { showToast('Could not reach Slack — check webhook URL in Settings', 'err') }
  }

  const sendAllAlerts = async () => {
    const urgent = enriched.filter(d => ['EXPIRED','CRITICAL','WARNING'].includes(d._sk))
    if (!urgent.length) { showToast('No accounts need alerts right now'); return }
    for (const d of urgent) { await sendSlack(d); await new Promise(r => setTimeout(r, 300)) }
    showToast(`✓ Sent ${urgent.length} alerts`)
  }

  // ── Specialist assignment ─────────────────────────────────────
  const saveSpec = (url, name) => {
    const m = { ...specMap, [url]: name }
    setSpecMap(m); persist(K.map, m)
    setEditSpec(null); setSpecInput('')
    showToast(`Assigned ${name || 'Unassigned'} to ${url}`)
  }

  // ── Enrich domains ────────────────────────────────────────────
  const enriched = domains
    .filter(d => !d.archived)
    .map(d => {
      const days = daysUntil(d.expires)
      return { ...d, _days: days, _sk: getStatusKey(days), _spec: specMap[d.url] || 'Unassigned' }
    })
    .sort((a, b) => (a._days ?? 9999) - (b._days ?? 9999))

  const filtered = enriched.filter(d => {
    const mf = filter === 'ALL' || d._sk === filter
    const ms = !search || d.url.toLowerCase().includes(search.toLowerCase()) || d._spec.toLowerCase().includes(search.toLowerCase())
    return mf && ms
  })

  const counts = { EXPIRED:0, CRITICAL:0, WARNING:0, ACTIVE:0, UNKNOWN:0 }
  enriched.forEach(d => counts[d._sk]++)

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={c.page}>
      {toast && <div style={c.toast(toast.type)}>{toast.msg}</div>}

      {/* Header */}
      <div style={c.header}>
        <div>
          <span style={{ fontSize:16, fontWeight:600 }}>Equaly Renewal Monitor</span>
          <span style={{ fontSize:12, color:'#888780', marginLeft:10 }}>DearDoc · ADA Compliance</span>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {['dashboard','sync','settings','log'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={c.tabBtn(tab===t)}>
              {t === 'sync' ? 'Sync' : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding:'22px 24px', maxWidth:1100, margin:'0 auto' }}>

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <>
            {/* Stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:20 }}>
              {[['EXPIRED','Expired'],['CRITICAL','1–7 Days'],['WARNING','8–30 Days'],['ACTIVE','Active']].map(([sk, lbl]) => (
                <div key={sk} onClick={() => setFilter(filter===sk ? 'ALL' : sk)} style={c.statCard(filter===sk, sk)}>
                  <div style={{ fontSize:28, fontWeight:600, color:STATUS[sk].color }}>{counts[sk]}</div>
                  <div style={{ fontSize:12, color:'#888780', marginTop:2 }}>{lbl}</div>
                </div>
              ))}
            </div>

            {/* Empty state */}
            {enriched.length === 0 && (
              <div style={{ ...c.card, textAlign:'center', padding:'60px 20px' }}>
                <div style={{ fontSize:38, marginBottom:12 }}>🔌</div>
                <div style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>No domains loaded yet</div>
                <div style={{ fontSize:13, color:'#888780', marginBottom:22 }}>Sync from Equally or load sample data to get started.</div>
                <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
                  <button onClick={() => setTab('sync')} style={c.btn('blue')}>Sync from Equally</button>
                  <button onClick={() => { setDomains(SAMPLE); persist(K.domains, SAMPLE); showToast('Sample data loaded') }} style={c.btn('gray')}>Load sample data</button>
                </div>
              </div>
            )}

            {/* Table */}
            {enriched.length > 0 && (
              <>
                <div style={{ display:'flex', gap:10, marginBottom:14, alignItems:'center' }}>
                  <input placeholder="Search domain or specialist…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...c.input, flex:1 }} />
                  <button onClick={sendAllAlerts} style={c.btn('blue')}>🔔 Send all alerts</button>
                  <button onClick={() => setTab('sync')} style={c.btn('gray')}>↻ Sync</button>
                </div>

                <div style={c.card}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#f8f8f6' }}>
                        {['Domain / Client','Specialist','Expiry Date','Days Left','Status','Actions'].map(h => (
                          <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontWeight:500, fontSize:11, color:'#888780', borderBottom:'1px solid #e5e5e2' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((d, i) => (
                        <tr key={d.url} style={{ borderBottom:'1px solid #e5e5e2', background: i%2===0 ? '#fff' : '#fafaf8' }}>
                          <td style={{ padding:'9px 14px', fontWeight:500 }}>
                            {d.url}
                            {!d.is_first_shown && <div style={{ fontSize:10, color:'#854F0B', marginTop:2 }}>⚠ Widget not detected on site</div>}
                          </td>
                          <td style={{ padding:'9px 14px' }}>
                            {editSpec === d.url ? (
                              <div style={{ display:'flex', gap:4 }}>
                                <input value={specInput} onChange={e => setSpecInput(e.target.value)}
                                  onKeyDown={e => { if(e.key==='Enter') saveSpec(d.url, specInput); if(e.key==='Escape') setEditSpec(null) }}
                                  autoFocus style={{ width:120, padding:'3px 8px', borderRadius:5, border:'1px solid #d0cfc8', fontSize:12, background:'#fff', color:'#1a1a1a', outline:'none' }}
                                />
                                <button onClick={() => saveSpec(d.url, specInput)} style={{ ...c.btn('green'), padding:'3px 8px', fontSize:11 }}>✓</button>
                              </div>
                            ) : (
                              <span onClick={() => { setEditSpec(d.url); setSpecInput(d._spec === 'Unassigned' ? '' : d._spec) }}
                                title="Click to assign" style={{ cursor:'pointer', color: d._spec==='Unassigned' ? '#aaa' : '#1a1a1a' }}>
                                {d._spec} <span style={{ fontSize:10, opacity:.4 }}>✏</span>
                              </span>
                            )}
                          </td>
                          <td style={{ padding:'9px 14px' }}>{fmtDate(d.expires)}</td>
                          <td style={{ padding:'9px 14px', fontWeight:600, color:STATUS[d._sk].color }}>
                            {d._days === null ? '—' : d._days < 0 ? 'Expired' : `${d._days}d`}
                          </td>
                          <td style={{ padding:'9px 14px' }}>
                            <span style={c.pill(d._sk)}>{STATUS[d._sk].label}</span>
                          </td>
                          <td style={{ padding:'9px 14px' }}>
                            <button onClick={() => sendSlack(d)} style={{ ...c.btn('gray'), padding:'4px 10px', fontSize:11 }}>
                              Slack alert
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && <div style={{ textAlign:'center', padding:'30px', fontSize:13, color:'#888780' }}>No results for this filter.</div>}
                </div>
              </>
            )}
          </>
        )}

        {/* ── SYNC ── */}
        {tab === 'sync' && (
          <div style={{ maxWidth:520 }}>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Sync from Equally</div>
            <div style={{ fontSize:13, color:'#888780', marginBottom:20 }}>Pull live domain and expiry data directly from your Equally account.</div>

            <div style={{ ...c.info, marginBottom:20 }}>
              <strong>Where to find these:</strong> Log into app.equally.ai → Settings → API or Developer section → copy Client ID, Client Secret, and your Business Slug.
            </div>

            {[
              { key:'clientId',     label:'Client ID',      placeholder:'your-client-id' },
              { key:'clientSecret', label:'Client Secret',  placeholder:'your-client-secret', type:'password' },
              { key:'slug',         label:'Business Slug',  placeholder:'e.g. deardoc' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} style={{ marginBottom:14 }}>
                <label style={c.label}>{label}</label>
                <input type={type || 'text'} value={cfg[key]} placeholder={placeholder}
                  onChange={e => { setCfg(p => ({...p, [key]:e.target.value})); setCfgDirty(true) }}
                  style={c.input} />
              </div>
            ))}

            {syncErr && <div style={{ ...c.err, marginBottom:14 }}>⚠ {syncErr}</div>}

            <div style={{ display:'flex', gap:10, marginBottom:24 }}>
              <button onClick={syncNow} disabled={syncing} style={{ ...c.btn('blue'), opacity: syncing ? .6 : 1 }}>
                {syncing ? 'Syncing…' : '↻ Sync now'}
              </button>
              <button onClick={saveCfg} style={c.btn('gray')}>Save credentials</button>
            </div>

            <div style={{ borderTop:'1px solid #e5e5e2', paddingTop:18 }}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:6 }}>No API access yet?</div>
              <div style={{ fontSize:12, color:'#888780', marginBottom:10 }}>Load sample data to explore the dashboard while you wait for API credentials from Equally.</div>
              <button onClick={() => { setDomains(SAMPLE); persist(K.domains, SAMPLE); showToast('Sample data loaded'); setTab('dashboard') }} style={c.btn('gray')}>
                Load sample data
              </button>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div style={{ maxWidth:500 }}>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Notification settings</div>
            <div style={{ fontSize:13, color:'#888780', marginBottom:22 }}>Configure where renewal alerts are delivered.</div>

            <div style={{ marginBottom:18 }}>
              <label style={c.label}>Slack Webhook URL</label>
              <input value={cfg.slackWebhook} placeholder="https://hooks.slack.com/services/..."
                onChange={e => { setCfg(p => ({...p, slackWebhook:e.target.value})); setCfgDirty(true) }}
                style={c.input} />
              <div style={c.helper}>api.slack.com/apps → Your App → Incoming Webhooks → Copy URL</div>
            </div>

            <div style={{ marginBottom:22 }}>
              <label style={c.label}>Alert email address</label>
              <input value={cfg.alertEmail} placeholder="team@deardoc.com"
                onChange={e => { setCfg(p => ({...p, alertEmail:e.target.value})); setCfgDirty(true) }}
                style={c.input} />
              <div style={c.helper}>Email alerts coming in v2 — save for now</div>
            </div>

            <button onClick={saveCfg} style={c.btn(cfgDirty ? 'blue' : 'gray')}>
              {cfgDirty ? 'Save settings' : 'Settings saved'}
            </button>

            <div style={{ marginTop:28, ...c.card, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:500, marginBottom:12 }}>Automatic alert schedule</div>
              {[
                ['30 days before expiry', STATUS.WARNING.color],
                ['7 days before expiry',  STATUS.CRITICAL.color],
                ['1 day before expiry',   STATUS.EXPIRED.color],
                ['Day of / after expiry', STATUS.EXPIRED.color],
              ].map(([lbl, col]) => (
                <div key={lbl} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:col, display:'inline-block', flexShrink:0 }}/>
                  <span style={{ fontSize:12, color:'#888780' }}>{lbl} — Slack alert fires</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LOG ── */}
        {tab === 'log' && (
          <>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Activity log</div>
            <div style={{ fontSize:13, color:'#888780', marginBottom:18 }}>All syncs, alerts sent, and actions.</div>
            {notifs.length === 0 ? (
              <div style={{ ...c.card, textAlign:'center', padding:'40px', fontSize:13, color:'#888780' }}>No activity yet.</div>
            ) : (
              <div style={c.card}>
                {notifs.map((n, i) => (
                  <div key={i} style={{ padding:'10px 14px', borderBottom: i<notifs.length-1 ? '1px solid #e5e5e2' : 'none', display:'flex', justifyContent:'space-between', alignItems:'center', background: i%2===0 ? '#fff' : '#fafaf8' }}>
                    <div>
                      <span style={{ fontSize:11, fontWeight:600, marginRight:8, color: n.type==='sync'?'#3B6D11':n.type==='slack'?'#185FA5':'#854F0B' }}>
                        {n.type==='sync' ? 'API Sync' : n.type==='slack' ? 'Slack' : 'Action'}
                      </span>
                      <span style={{ fontSize:13 }}>{n.account || ''}</span>
                      <span style={{ fontSize:12, color:'#888780', marginLeft:6 }}>— {n.msg}</span>
                    </div>
                    <div style={{ fontSize:11, color:'#aaa' }}>{new Date(n.ts).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}
            {notifs.length > 0 && (
              <button onClick={() => { setNotifs([]); persist(K.notifs, []) }} style={{ ...c.btn('gray'), marginTop:12, fontSize:12 }}>
                Clear log
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
