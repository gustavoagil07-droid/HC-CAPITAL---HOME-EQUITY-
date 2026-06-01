// ── SUPABASE CONFIG ────────────────────────────────────────
const SUPABASE_URL  = 'COLE_SUA_URL_AQUI';
const SUPABASE_KEY  = 'COLE_SUA_ANON_KEY_AQUI';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── BANCO MULTI-SELECT ─────────────────────────────────────
const BANCOS = [
  { k:'BANCO INTER',  cls:'b-inter'    },
  { k:'CREDITAS',     cls:'b-creditas' },
  { k:'CASHME',       cls:'b-cashme'   },
  { k:'C6',           cls:'b-c6'       },
  { k:'BANCO BARI',   cls:'b-bari'     },
  { k:'CREDIBLUE',    cls:'b-crediblue'},
];

let selectedBancos = [];

function initBancoPills() {
  const wrap = document.getElementById('banco-pills');
  wrap.innerHTML = BANCOS.map(b =>
    `<span class="banco-pill ${b.cls}" data-banco="${b.k}" onclick="toggleBanco('${b.k}')">${b.k}</span>`
  ).join('');
}

function toggleBanco(key) {
  if (selectedBancos.includes(key)) {
    selectedBancos = selectedBancos.filter(x => x !== key);
  } else {
    selectedBancos.push(key);
  }
  updateBancoPills();
}

function updateBancoPills() {
  document.querySelectorAll('.banco-pill').forEach(el => {
    el.classList.toggle('sel', selectedBancos.includes(el.dataset.banco));
  });
  const preview = document.getElementById('banco-preview');
  preview.textContent = selectedBancos.length ? '· ' + selectedBancos.join(' / ') : '';
}

function getBancoValue() {
  return selectedBancos.join(' / ');
}

function setBancoValue(val) {
  selectedBancos = [];
  if (val) {
    const parts = val.split(/\s*[\/,+&e]\s*/i).map(x => x.trim().toUpperCase());
    parts.forEach(p => {
      const found = BANCOS.find(b =>
        b.k.toUpperCase() === p ||
        b.k.toUpperCase().includes(p) ||
        p.includes(b.k.toUpperCase())
      );
      if (found && !selectedBancos.includes(found.k)) selectedBancos.push(found.k);
    });
    if (selectedBancos.length === 0) {
      document.getElementById('banco-preview').textContent = '· ' + val;
      return;
    }
  }
  updateBancoPills();
}

// ── STATUS CONFIG ──────────────────────────────────────────
const ST = {
  doc:  { label:'Análise Inicial / Documentação', cls:'s-doc',  col:'#2563eb' },
  cred: { label:'Análise de Crédito',             cls:'s-cred', col:'#d97706' },
  vist: { label:'Vistoria',                       cls:'s-vist', col:'#7c3aed' },
  neg2: { label:'Negociação Proposta',            cls:'s-neg2', col:'#0891b2' },
  cont: { label:'Contrato Assinado',              cls:'s-cont', col:'#059669' },
  neg:  { label:'Negada',                         cls:'s-neg',  col:'#ef4444' },
};

function migrate(st) {
  const m = { i:'doc', a:'cred', j:'vist', co:'neg2', ag:'doc', lib:'cont' };
  return ST[st] ? st : (m[st] || 'doc');
}

// ── ESTADO ─────────────────────────────────────────────────
let ops    = [];
let editId = null;
let view   = 'lista';
let dragId = null;

// ── SUPABASE: CARREGAR ─────────────────────────────────────
async function loadOps() {
  document.getElementById('tbody').innerHTML =
    '<tr><td colspan="10" class="loading">Carregando operações…</td></tr>';

  const { data, error } = await db
    .from('operacoes')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    console.error('Erro ao carregar:', error);
    toast('⚠ Erro ao carregar dados');
    return;
  }

  ops = (data || []).map(o => ({ ...o, st: migrate(o.st) }));
  render();
}

// ── SUPABASE: SALVAR ───────────────────────────────────────
async function saveOp() {
  const nome = document.getElementById('f-nome').value.toUpperCase().trim();
  if (!nome) { toast('⚠ Informe o nome do cliente'); return; }

  const payload = {
    nome,
    ind:   document.getElementById('f-ind').value.trim(),
    banco: getBancoValue(),
    gar:   document.getElementById('f-gar').value.trim(),
    vg:    parseFloat(document.getElementById('f-vg').value) || 0,
    vc:    parseFloat(document.getElementById('f-vc').value) || 0,
    etapa: document.getElementById('f-etapa').value.trim(),
    st:    document.getElementById('f-st').value,
    obs:   document.getElementById('f-obs').value.trim(),
  };

  let error;
  if (editId) {
    ({ error } = await db.from('operacoes').update(payload).eq('id', editId));
  } else {
    ({ error } = await db.from('operacoes').insert(payload));
  }

  if (error) {
    console.error('Erro ao salvar:', error);
    toast('⚠ Erro ao salvar operação');
    return;
  }

  toast(editId ? '✓ Operação atualizada' : '✓ Operação adicionada');
  closeModal();
  await loadOps();
}

// ── SUPABASE: EXCLUIR ──────────────────────────────────────
async function delOp() {
  if (!confirm('Remover esta operação?')) return;

  const { error } = await db.from('operacoes').delete().eq('id', editId);
  if (error) {
    toast('⚠ Erro ao excluir operação');
    return;
  }

  toast('Operação removida');
  closeModal();
  await loadOps();
}

// ── SUPABASE: ATUALIZAR STATUS (drag & drop) ───────────────
async function updateStatus(id, newSt) {
  const { error } = await db.from('operacoes').update({ st: newSt }).eq('id', id);
  if (error) {
    toast('⚠ Erro ao mover operação');
    return false;
  }
  return true;
}

// ── HELPERS ────────────────────────────────────────────────
function bankCls(b) {
  const u = (b || '').toUpperCase();
  if (u === 'BANCO INTER') return 'b-inter';
  if (u === 'CREDITAS')    return 'b-creditas';
  if (u === 'CASHME')      return 'b-cashme';
  if (u === 'C6')          return 'b-c6';
  if (u === 'BANCO BARI' || u === 'BARI') return 'b-bari';
  if (u === 'CREDIBLUE')   return 'b-crediblue';
  return 'b-multi';
}

function fmt(v) {
  if (!v || v <= 0) return '—';
  if (v >= 1000000) return 'R$ ' + (v / 1000000).toFixed(1).replace('.0', '') + 'M';
  return 'R$ ' + (v / 1000).toFixed(0) + 'k';
}

// ── KPIs ───────────────────────────────────────────────────
function renderKPIs() {
  const ativas    = ops.filter(o => o.st !== 'neg');
  const vol       = ativas.reduce((a, o) => a + (o.vc || 0), 0);
  const andamento = ativas.filter(o => o.st !== 'cont').length;
  const neg       = ops.filter(o => o.st === 'neg').length;
  const kdata = [
    { l:'Operações Ativas',  v: ativas.length, s:'excl. negadas',        kl:'var(--green)'  },
    { l:'Volume em Carteira',v: fmt(vol),       s:'crédito solicitado',   kl:'#2563eb', mono:true },
    { l:'Em Andamento',      v: andamento,      s:'aguardando ação',      kl:'#d97706'       },
    { l:'Crédito Liberado',  v:'R$ 5,6M',  s:'capital desembolsado', kl:'#059669', mono:true },
    { l:'Negadas',           v: neg,            s:'não convertidas',      kl:'#dc2626'       },
  ];
  document.getElementById('kpis').innerHTML = kdata.map(k =>
    `<div class="kpi" style="--kl:${k.kl}">
      <div class="kpi-label">${k.l}</div>
      <div class="kpi-value${k.mono ? ' mono' : ''}">${k.v}</div>
      <div class="kpi-sub">${k.s}</div>
    </div>`
  ).join('');
}

// ── FILTRO ─────────────────────────────────────────────────
function getFiltered(includeNeg) {
  const q  = (document.getElementById('q').value || '').toLowerCase();
  const fb = document.getElementById('fb').value;
  const fs = document.getElementById('fs').value;
  return ops.filter(o => {
    if (!includeNeg && o.st === 'neg') return false;
    const mq = !q  || (o.nome||'').toLowerCase().includes(q) || (o.banco||'').toLowerCase().includes(q) || (o.ind||'').toLowerCase().includes(q);
    const mb = !fb || (o.banco||'').toUpperCase().includes(fb);
    const ms = !fs || o.st === fs;
    return mq && mb && ms;
  });
}

// ── TABELA ─────────────────────────────────────────────────
function renderTable() {
  const rows = getFiltered(false);
  document.getElementById('rlabel').innerHTML =
    `Mostrando <strong>${rows.length}</strong> operaç${rows.length === 1 ? 'ão' : 'ões'} ativas`;
  document.getElementById('tbody').innerHTML = rows.length
    ? rows.map((o, i) => {
        const st = ST[o.st] || ST.doc;
        return `<tr onclick="openModal(${o.id})">
          <td style="font-family:var(--mono);font-size:11px;color:var(--t3)">${String(i + 1).padStart(2, '0')}</td>
          <td><div class="tdnome">${o.nome}</div></td>
          <td><div class="tdind">${o.ind || '—'}</div></td>
          <td><span class="banco ${bankCls(o.banco)}">${o.banco || '—'}</span></td>
          <td><div class="tdgar">${o.gar || '—'}</div></td>
          <td><div class="tdval">${fmt(o.vg)}</div></td>
          <td><div class="tdval">${fmt(o.vc)}</div></td>
          <td><span class="status ${st.cls}">${st.label}</span></td>
          <td><div class="tdetapa">${o.etapa || '—'}</div></td>
          <td><div class="tdobs">${o.obs || '—'}</div></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--t3)">Nenhuma operação encontrada.</td></tr>`;
  renderKPIs();
}

// ── PIPELINE ───────────────────────────────────────────────
const STAGES = [
  { k:'doc',  l:'Análise Inicial\nDocumentação' },
  { k:'cred', l:'Análise de\nCrédito'           },
  { k:'vist', l:'Vistoria'                       },
  { k:'neg2', l:'Negociação\nProposta'           },
  { k:'cont', l:'Contrato\nAssinado'             },
  { k:'neg',  l:'Negadas'                        },
];

function renderPipe() {
  const q  = (document.getElementById('q').value || '').toLowerCase();
  const fb = document.getElementById('fb').value;
  const rows  = ops.filter(o => {
    const mq = !q  || (o.nome||'').toLowerCase().includes(q) || (o.banco||'').toLowerCase().includes(q);
    const mb = !fb || (o.banco||'').toUpperCase().includes(fb);
    return mq && mb;
  });
  const ativas = rows.filter(o => o.st !== 'neg').length;
  const negN   = rows.filter(o => o.st === 'neg').length;
  document.getElementById('rlabel').innerHTML =
    `<strong>${ativas}</strong> operaç${ativas === 1 ? 'ão' : 'ões'} ativas · <strong>${negN}</strong> negadas · <span style="color:var(--t3);font-size:11px">Arraste os cards entre colunas para mover</span>`;

  document.getElementById('pboard').innerHTML = STAGES.map(s => {
    const cfg   = ST[s.k] || ST.doc;
    const cards = rows.filter(o => o.st === s.k);
    const isNeg = s.k === 'neg';
    return `<div class="pipe-col">
      <div class="pipe-head" style="${isNeg ? 'background:#fef2f2' : ''}">
        <span class="pipe-head-label" style="color:${cfg.col}">${s.l.replace('\n','<br>')}</span>
        <span class="pipe-count">${cards.length}</span>
      </div>
      <div class="pipe-body" id="body-${s.k}"
        ondragover="onDragOver(event,'${s.k}')"
        ondragleave="onDragLeave(event,'${s.k}')"
        ondrop="onDrop(event,'${s.k}')">
        ${cards.length
          ? cards.map(o => `
            <div class="pipe-card" style="--col:${cfg.col}"
              draggable="true" data-id="${o.id}"
              ondragstart="onDragStart(event,${o.id})"
              ondragend="onDragEnd(event)"
              onclick="openModal(${o.id})">
              <div class="pipe-card-nome">${o.nome}</div>
              <div class="pipe-card-banco">${o.banco || '—'}</div>
              <div class="pipe-card-val" style="${isNeg ? 'color:var(--t3)' : ''}">${fmt(o.vc)}</div>
            </div>`).join('')
          : `<div class="pipe-empty">Arraste aqui</div>`}
      </div>
    </div>`;
  }).join('');
  renderKPIs();
}

// ── DRAG & DROP ────────────────────────────────────────────
function onDragStart(e, id) {
  dragId = id;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => e.target.classList.add('dragging'), 0);
}
function onDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.pipe-body').forEach(b => b.classList.remove('over'));
}
function onDragOver(e, key) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  document.getElementById('body-' + key)?.classList.add('over');
}
function onDragLeave(e, key) {
  document.getElementById('body-' + key)?.classList.remove('over');
}
async function onDrop(e, key) {
  e.preventDefault();
  document.getElementById('body-' + key)?.classList.remove('over');
  if (dragId === null) return;
  const op = ops.find(o => o.id === dragId);
  if (op && op.st !== key) {
    const ok = await updateStatus(dragId, key);
    if (ok) {
      op.st = key;
      renderPipe();
      toast('✓ ' + op.nome + ' → ' + ST[key].label);
    }
  }
  dragId = null;
}

// ── RENDER / TAB ───────────────────────────────────────────
function render() {
  if (view === 'lista') renderTable(); else renderPipe();
}
function switchTab(t, btn) {
  view = t;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById('v-lista').style.display = t === 'lista' ? 'block' : 'none';
  document.getElementById('v-pipe').style.display  = t === 'pipe'  ? 'block' : 'none';
  render();
}

// ── MODAL ──────────────────────────────────────────────────
function openModal(id) {
  editId = id;
  const o = id ? ops.find(x => x.id === id) : null;
  document.getElementById('mtitle').textContent = o ? o.nome : 'Nova Operação';
  document.getElementById('msub').textContent   = o ? `ID #${o.id} · 2026` : 'Preencha os dados abaixo';
  document.getElementById('bdel').style.display = o ? 'block' : 'none';
  const map = { nome:'f-nome', ind:'f-ind', gar:'f-gar', vg:'f-vg', vc:'f-vc', etapa:'f-etapa', st:'f-st', obs:'f-obs' };
  if (o) {
    Object.entries(map).forEach(([k, fid]) => {
      const el = document.getElementById(fid);
      if (el) el.value = o[k] || '';
    });
    document.getElementById('f-op').value = o.op || 'HOME EQUITY';
    setBancoValue(o.banco || '');
  } else {
    Object.values(map).forEach(fid => {
      const el = document.getElementById(fid);
      if (el) el.value = '';
    });
    document.getElementById('f-op').value  = 'HOME EQUITY';
    document.getElementById('f-st').value  = 'doc';
    setBancoValue('');
  }
  document.getElementById('overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  editId = null;
}
function outsideClose(e) {
  if (e.target === document.getElementById('overlay')) closeModal();
}

// ── TOAST ──────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 2600);
}

// ── INIT ───────────────────────────────────────────────────
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

const nd = new Date();
document.getElementById('hdate').textContent =
  nd.toLocaleDateString('pt-BR', {
    weekday:'short', day:'2-digit', month:'short', year:'numeric', timeZone:'America/Sao_Paulo'
  }).toUpperCase();

initBancoPills();
loadOps();
