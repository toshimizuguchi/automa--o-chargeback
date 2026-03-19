/* ============================================
   ChargeGuard — Automação de Chargebacks
   Aplicação Completa
   ============================================ */

// ============================================
// DATA STORE
// ============================================
const MOTIVOS_MAP = {
    'fraude': 'Fraude / Não reconhecida',
    'produto-nao-recebido': 'Produto não recebido',
    'produto-diferente': 'Produto diferente',
    'cobranca-duplicada': 'Cobrança duplicada',
    'cancelamento': 'Cancelamento não processado',
    'valor-incorreto': 'Valor incorreto',
    'servico-nao-prestado': 'Serviço não prestado',
    'outros': 'Outros'
};

const STATUS_LABELS = {
    'recebido': 'Recebido',
    'em-analise': 'Em Análise',
    'em-disputa': 'Em Disputa',
    'ganho': 'Ganho',
    'perdido': 'Perdido'
};

const STATUS_FLOW = ['recebido', 'em-analise', 'em-disputa', 'ganho'];

const BANDEIRAS_MAP = {
    'visa': 'Visa',
    'mastercard': 'Mastercard',
    'elo': 'Elo',
    'amex': 'American Express',
    'hipercard': 'Hipercard'
};

// Sample Data
let chargebacks = generateSampleData();
let notifications = generateSampleNotifications();
let uploadedFiles = [];

// Função para Sync Manual do Banco de Dados
async function syncFromDatabase() {
    const btn = document.getElementById('btn-sync-now');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '🔄 Sincronizando...';
        btn.classList.add('loading');

        const response = await fetch('http://localhost:8000/api/chargebacks/');
        const dadosReais = await response.json();

        if (dadosReais.error) throw new Error(dadosReais.error);

        // Atualiza a lista global de chargebacks com os dados do banco
        // Mantemos os samples se quiser, ou limpamos (vamos limpar para ver o real)
        chargebacks = dadosReais;
        
        // Avisa o usuário e atualiza a interface
        showToast('success', `${dadosReais.length} cases carregados do Supabase!`);
        renderDashboard();
        renderCasesTable();
        
    } catch (error) {
        console.error("Erro no sync:", error);
        showToast('error', 'Falha ao conectar com o Backend API local.');
    } finally {
        btn.innerHTML = originalText;
        btn.classList.remove('loading');
    }
}

// Bind do botão de Sync
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-sync-now')?.addEventListener('click', syncFromDatabase);
});

// ============================================
// SAMPLE DATA GENERATORS
// ============================================
function generateSampleData() {
    const nomes = [
        'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa', 
        'Lucas Ferreira', 'Gabriela Lima', 'Rafael Souza', 'Juliana Pereira',
        'Bruno Martins', 'Camila Rodrigues', 'Felipe Almeida', 'Larissa Nascimento',
        'Thiago Ribeiro', 'Fernanda Gomes', 'Matheus Barbosa'
    ];
    const motivos = Object.keys(MOTIVOS_MAP);
    const bandeiras = Object.keys(BANDEIRAS_MAP);
    const statuses = ['recebido', 'em-analise', 'em-disputa', 'ganho', 'perdido'];

    const data = [];
    for (let i = 0; i < 25; i++) {
        const nome = nomes[Math.floor(Math.random() * nomes.length)];
        const motivo = motivos[Math.floor(Math.random() * motivos.length)];
        const bandeira = bandeiras[Math.floor(Math.random() * bandeiras.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const valor = (Math.random() * 5000 + 50).toFixed(2);
        const dataTransacao = new Date(2026, Math.floor(Math.random() * 3), Math.floor(Math.random() * 28) + 1);
        const dataRecebimento = new Date(dataTransacao.getTime() + Math.random() * 15 * 24 * 60 * 60 * 1000);
        const prazo = new Date(dataRecebimento.getTime() + 30 * 24 * 60 * 60 * 1000);

        const historico = [{
            data: dataRecebimento,
            texto: 'Chargeback registrado no sistema'
        }];

        if (['em-analise', 'em-disputa', 'ganho', 'perdido'].includes(status)) {
            historico.push({
                data: new Date(dataRecebimento.getTime() + 2 * 24 * 60 * 60 * 1000),
                texto: 'Caso movido para análise. Coleta de evidências iniciada.'
            });
        }
        if (['em-disputa', 'ganho', 'perdido'].includes(status)) {
            historico.push({
                data: new Date(dataRecebimento.getTime() + 7 * 24 * 60 * 60 * 1000),
                texto: 'Defesa preparada e enviada à bandeira do cartão.'
            });
        }
        if (['ganho', 'perdido'].includes(status)) {
            historico.push({
                data: new Date(dataRecebimento.getTime() + 20 * 24 * 60 * 60 * 1000),
                texto: status === 'ganho' ? 'Disputa ganha! Valor recuperado com sucesso.' : 'Disputa perdida. Débito confirmado.'
            });
        }

        data.push({
            id: `CB-${String(2025001 + i).padStart(7, '0')}`,
            cliente: {
                nome,
                email: nome.toLowerCase().replace(/\s/g, '.') + '@email.com',
                cpf: generateCPF(),
                telefone: generatePhone()
            },
            transacao: {
                id: `TXN-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
                valor: parseFloat(valor),
                data: dataTransacao,
                bandeira
            },
            motivo,
            codigoMotivo: `${Math.floor(Math.random() * 9999)}`,
            dataRecebimento,
            prazo,
            status,
            descricao: `Chargeback registrado pelo motivo: ${MOTIVOS_MAP[motivo]}`,
            evidencias: [],
            historico
        });
    }

    return data.sort((a, b) => b.dataRecebimento - a.dataRecebimento);
}

function generateCPF() {
    const n = () => Math.floor(Math.random() * 10);
    return `${n()}${n()}${n()}.${n()}${n()}${n()}.${n()}${n()}${n()}-${n()}${n()}`;
}

function generatePhone() {
    const n = () => Math.floor(Math.random() * 10);
    return `(${n()}${n()}) ${n()}${n()}${n()}${n()}${n()}-${n()}${n()}${n()}${n()}`;
}

function generateSampleNotifications() {
    return [
        {
            id: 1,
            type: 'danger',
            icon: '🚨',
            title: 'Prazo Crítico!',
            text: 'CB-2025003 vence em 2 dias. Ação imediata necessária.',
            time: 'Há 1 hora',
            unread: true
        },
        {
            id: 2,
            type: 'warning',
            icon: '⚠️',
            title: 'Novo Chargeback Recebido',
            text: 'Chargeback de R$ 1.250,00 registrado por fraude.',
            time: 'Há 3 horas',
            unread: true
        },
        {
            id: 3,
            type: 'success',
            icon: '✅',
            title: 'Disputa Ganha!',
            text: 'CB-2025010 — R$ 890,50 recuperado com sucesso.',
            time: 'Há 5 horas',
            unread: true
        },
        {
            id: 4,
            type: 'info',
            icon: 'ℹ️',
            title: 'Atualização de Status',
            text: 'CB-2025005 movido para "Em Disputa".',
            time: 'Ontem',
            unread: false
        },
        {
            id: 5,
            type: 'warning',
            icon: '⏰',
            title: 'Lembrete de Prazo',
            text: '3 chargebacks vencem esta semana.',
            time: 'Ontem',
            unread: false
        }
    ];
}

// ============================================
// NAVIGATION
// ============================================
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const pageTitle = document.getElementById('page-title');
const pageSubtitle = document.getElementById('page-subtitle');

const PAGE_TITLES = {
    'dashboard': { title: 'Dashboard', subtitle: 'Visão geral dos chargebacks' },
    'novo-chargeback': { title: 'Novo Chargeback', subtitle: 'Registrar um novo caso' },
    'casos': { title: 'Gestão de Casos', subtitle: 'Todos os chargebacks registrados' },
    'fluxo': { title: 'Fluxo Automatizado', subtitle: 'Pipeline de processamento' },
    'relatorios': { title: 'Relatórios', subtitle: 'Métricas e indicadores de performance' }
};

function navigateToPage(pageName) {
    navItems.forEach(item => item.classList.remove('active'));
    pages.forEach(page => page.classList.remove('active'));

    const activeNav = document.querySelector(`[data-page="${pageName}"]`);
    const activePage = document.getElementById(`page-${pageName}`);
    
    if (activeNav) activeNav.classList.add('active');
    if (activePage) activePage.classList.add('active');

    const info = PAGE_TITLES[pageName];
    if (info) {
        pageTitle.textContent = info.title;
        pageSubtitle.textContent = info.subtitle;
    }

    // Render page-specific content
    if (pageName === 'dashboard') renderDashboard();
    if (pageName === 'casos') renderCasesTable();
    if (pageName === 'fluxo') renderFlowPipeline();
    if (pageName === 'relatorios') renderReports();

    // Close sidebar on mobile
    document.getElementById('sidebar').classList.remove('open');
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navigateToPage(item.dataset.page);
    });
});

// Menu toggle
document.getElementById('menu-toggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ============================================
// DASHBOARD
// ============================================
function renderDashboard() {
    updateMetrics();
    renderTimelineChart();
    renderReasonsChart();
    renderRecentCases();
}

function updateMetrics() {
    const total = chargebacks.length;
    const emDisputa = chargebacks.filter(c => c.status === 'em-disputa').length;
    const ganhos = chargebacks.filter(c => c.status === 'ganho');
    const valorRecuperado = ganhos.reduce((sum, c) => sum + c.transacao.valor, 0);
    const resolvidos = chargebacks.filter(c => ['ganho', 'perdido'].includes(c.status));
    const taxaSucesso = resolvidos.length > 0 ? ((ganhos.length / resolvidos.length) * 100).toFixed(0) : 0;

    animateCounter('metric-total-value', total);
    animateCounter('metric-disputa-value', emDisputa);
    document.getElementById('metric-recuperado-value').textContent = `R$ ${valorRecuperado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    document.getElementById('metric-taxa-value').textContent = `${taxaSucesso}%`;
}

function animateCounter(elementId, target) {
    const element = document.getElementById(elementId);
    let current = 0;
    const increment = Math.ceil(target / 30);
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = current;
    }, 30);
}

function renderTimelineChart() {
    const canvas = document.getElementById('timeline-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 44;
    canvas.height = 250;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Generate data for last 7 days
    const days = [];
    const values = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }));
        values.push(Math.floor(Math.random() * 8) + 1);
    }

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;
    const maxVal = Math.max(...values) + 2;

    // Grid lines
    ctx.strokeStyle = '#1f1f2e';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(canvas.width - padding.right, y);
        ctx.stroke();

        ctx.fillStyle = '#6b7280';
        ctx.font = '11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), padding.left - 10, y + 4);
    }

    // Draw gradient area + line
    const gradient = ctx.createLinearGradient(0, padding.top, 0, canvas.height - padding.bottom);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.25)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    const points = values.map((v, i) => ({
        x: padding.left + (chartWidth / (values.length - 1)) * i,
        y: padding.top + chartHeight - (v / maxVal) * chartHeight
    }));

    // Area
    ctx.beginPath();
    ctx.moveTo(points[0].x, canvas.height - padding.bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, canvas.height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        const cp1x = (points[i - 1].x + points[i].x) / 2;
        ctx.bezierCurveTo(cp1x, points[i - 1].y, cp1x, points[i].y, points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dots
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    });

    // X Labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    days.forEach((day, i) => {
        const x = padding.left + (chartWidth / (days.length - 1)) * i;
        ctx.fillText(day, x, canvas.height - 10);
    });
}

function renderReasonsChart() {
    const canvas = document.getElementById('reasons-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 44;
    canvas.height = 250;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Count reasons
    const reasonCounts = {};
    chargebacks.forEach(c => {
        const label = MOTIVOS_MAP[c.motivo] || c.motivo;
        reasonCounts[label] = (reasonCounts[label] || 0) + 1;
    });

    const sorted = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = sorted.reduce((s, [, v]) => s + v, 0);

    const colors = ['#6366f1', '#8b5cf6', '#3b82f6', '#f59e0b', '#10b981'];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 40;

    let startAngle = -Math.PI / 2;
    sorted.forEach(([label, count], i) => {
        const sliceAngle = (count / total) * Math.PI * 2;
        
        // Draw slice
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[i];
        ctx.fill();

        // Label
        const midAngle = startAngle + sliceAngle / 2;
        const labelRadius = radius + 20;
        const lx = centerX + Math.cos(midAngle) * labelRadius;
        const ly = centerY + Math.sin(midAngle) * labelRadius;
        
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px Inter';
        ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
        const shortLabel = label.length > 15 ? label.substring(0, 15) + '...' : label;
        ctx.fillText(`${shortLabel} (${count})`, lx, ly);

        startAngle += sliceAngle;
    });

    // Center hole (donut)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#14141e';
    ctx.fill();

    // Center text
    ctx.fillStyle = '#f0f0f5';
    ctx.font = 'bold 18px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, centerX, centerY - 8);
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Inter';
    ctx.fillText('Total', centerX, centerY + 12);
}

function renderRecentCases() {
    const tbody = document.getElementById('recent-cases-body');
    if (!tbody) return;
    
    const recent = chargebacks.slice(0, 5);
    tbody.innerHTML = recent.map(c => `
        <tr>
            <td><span style="color: var(--indigo-400); font-weight: 600;">${c.id}</span></td>
            <td>${c.cliente.nome}</td>
            <td><strong>R$ ${c.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
            <td>${MOTIVOS_MAP[c.motivo] || c.motivo}</td>
            <td>${getStatusBadge(c.status)}</td>
            <td>${getPrazoDisplay(c.prazo)}</td>
            <td>
                <button class="action-btn" onclick="openCaseDetail('${c.id}')" title="Ver detalhes">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                ${c.status !== 'ganho' && c.status !== 'perdido' ? `
                <button class="action-btn advance" onclick="advanceCase('${c.id}')" title="Avançar etapa">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>` : ''}
            </td>
        </tr>
    `).join('');
}

// ============================================
// CASES TABLE
// ============================================
let currentFilter = 'todos';

function renderCasesTable(filter = currentFilter) {
    currentFilter = filter;
    const tbody = document.getElementById('cases-table-body');
    if (!tbody) return;

    let filtered = chargebacks;
    if (filter !== 'todos') {
        filtered = chargebacks.filter(c => c.status === filter);
    }

    const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.id.toLowerCase().includes(searchTerm) ||
            c.cliente.nome.toLowerCase().includes(searchTerm) ||
            c.cliente.email.toLowerCase().includes(searchTerm)
        );
    }

    tbody.innerHTML = filtered.map(c => `
        <tr>
            <td><input type="checkbox" class="case-checkbox" data-id="${c.id}"></td>
            <td><span style="color: var(--indigo-400); font-weight: 600;">${c.id}</span></td>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span>${c.cliente.nome}</span>
                    <span style="font-size: 0.72rem; color: var(--text-muted);">${c.cliente.email}</span>
                </div>
            </td>
            <td><strong>R$ ${c.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
            <td>${MOTIVOS_MAP[c.motivo] || c.motivo}</td>
            <td>${BANDEIRAS_MAP[c.transacao.bandeira] || c.transacao.bandeira}</td>
            <td>${getStatusBadge(c.status)}</td>
            <td>${getPrazoDisplay(c.prazo)}</td>
            <td>${getEtapaDisplay(c.status)}</td>
            <td>
                <div style="display: flex; gap: 6px;">
                    <button class="action-btn" onclick="openCaseDetail('${c.id}')" title="Ver detalhes">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    ${c.status !== 'ganho' && c.status !== 'perdido' ? `
                    <button class="action-btn advance" onclick="advanceCase('${c.id}')" title="Avançar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

// Filter chips
document.querySelectorAll('.chip[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
        document.querySelectorAll('.chip[data-filter]').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        renderCasesTable(chip.dataset.filter);
    });
});

// Search
document.getElementById('search-input')?.addEventListener('input', () => {
    if (document.getElementById('page-casos').classList.contains('active')) {
        renderCasesTable();
    }
});

// Select All
document.getElementById('select-all')?.addEventListener('change', (e) => {
    document.querySelectorAll('.case-checkbox').forEach(cb => cb.checked = e.target.checked);
});

// ============================================
// FLOW PIPELINE
// ============================================
function renderFlowPipeline() {
    const stages = {
        'recebido': chargebacks.filter(c => c.status === 'recebido'),
        'analise': chargebacks.filter(c => c.status === 'em-analise'),
        'disputa': chargebacks.filter(c => c.status === 'em-disputa'),
        'resolucao': chargebacks.filter(c => c.status === 'ganho' || c.status === 'perdido')
    };

    Object.entries(stages).forEach(([key, cases]) => {
        const countEl = document.getElementById(`stage-count-${key}`);
        const casesEl = document.getElementById(`stage-cases-${key}`);
        
        if (countEl) countEl.textContent = `${cases.length} caso${cases.length !== 1 ? 's' : ''}`;
        if (casesEl) {
            casesEl.innerHTML = cases.slice(0, 5).map(c => `
                <div class="stage-case-item" onclick="openCaseDetail('${c.id}')">
                    <span class="case-id">${c.id}</span>
                    <span class="case-value">R$ ${c.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
            `).join('');
            if (cases.length > 5) {
                casesEl.innerHTML += `<div class="stage-case-item" style="justify-content: center; color: var(--text-muted);">
                    + ${cases.length - 5} outros casos
                </div>`;
            }
        }
    });
}

// ============================================
// REPORTS
// ============================================
function renderReports() {
    renderMonthlyChart();
    renderStatusChart();
    renderBandeiraChart();
    renderKPIs();
}

function renderMonthlyChart() {
    const canvas = document.getElementById('monthly-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 44;
    canvas.height = 280;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const received = months.map(() => Math.floor(Math.random() * 15) + 5);
    const won = months.map((_, i) => Math.floor(received[i] * (0.4 + Math.random() * 0.3)));

    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;
    const maxVal = Math.max(...received) + 5;
    const barGroupWidth = chartWidth / months.length;
    const barWidth = barGroupWidth * 0.3;

    // Grid
    ctx.strokeStyle = '#1f1f2e';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(canvas.width - padding.right, y);
        ctx.stroke();
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxVal - (maxVal / 5) * i), padding.left - 10, y + 4);
    }

    months.forEach((month, i) => {
        const x = padding.left + barGroupWidth * i + barGroupWidth / 2;

        // Received bar
        const h1 = (received[i] / maxVal) * chartHeight;
        const barGrad1 = ctx.createLinearGradient(0, canvas.height - padding.bottom - h1, 0, canvas.height - padding.bottom);
        barGrad1.addColorStop(0, '#6366f1');
        barGrad1.addColorStop(1, '#4f46e5');
        roundedRect(ctx, x - barWidth - 2, canvas.height - padding.bottom - h1, barWidth, h1, 4);
        ctx.fillStyle = barGrad1;
        ctx.fill();

        // Won bar
        const h2 = (won[i] / maxVal) * chartHeight;
        const barGrad2 = ctx.createLinearGradient(0, canvas.height - padding.bottom - h2, 0, canvas.height - padding.bottom);
        barGrad2.addColorStop(0, '#10b981');
        barGrad2.addColorStop(1, '#059669');
        roundedRect(ctx, x + 2, canvas.height - padding.bottom - h2, barWidth, h2, 4);
        ctx.fillStyle = barGrad2;
        ctx.fill();

        // Label
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(month, x, canvas.height - 10);
    });

    // Legend
    ctx.fillStyle = '#6366f1';
    ctx.fillRect(canvas.width - 200, 10, 12, 12);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('Recebidos', canvas.width - 183, 20);

    ctx.fillStyle = '#10b981';
    ctx.fillRect(canvas.width - 100, 10, 12, 12);
    ctx.fillStyle = '#9ca3af';
    ctx.fillText('Ganhos', canvas.width - 83, 20);
}

function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function renderStatusChart() {
    const canvas = document.getElementById('status-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 44;
    canvas.height = 280;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const statusCounts = {};
    chargebacks.forEach(c => {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    const statusColors = {
        'recebido': '#3b82f6',
        'em-analise': '#f59e0b',
        'em-disputa': '#8b5cf6',
        'ganho': '#10b981',
        'perdido': '#ef4444'
    };

    const entries = Object.entries(statusCounts);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 50;

    let startAngle = -Math.PI / 2;
    entries.forEach(([status, count]) => {
        const sliceAngle = (count / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = statusColors[status] || '#6b7280';
        ctx.fill();

        const midAngle = startAngle + sliceAngle / 2;
        const lx = centerX + Math.cos(midAngle) * (radius + 18);
        const ly = centerY + Math.sin(midAngle) * (radius + 18);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px Inter';
        ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
        ctx.fillText(`${STATUS_LABELS[status]} (${count})`, lx, ly);

        startAngle += sliceAngle;
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = '#14141e';
    ctx.fill();
}

function renderBandeiraChart() {
    const canvas = document.getElementById('bandeira-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width - 44;
    canvas.height = 280;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bandeiraCounts = {};
    chargebacks.forEach(c => {
        const label = BANDEIRAS_MAP[c.transacao.bandeira] || c.transacao.bandeira;
        bandeiraCounts[label] = (bandeiraCounts[label] || 0) + 1;
    });

    const entries = Object.entries(bandeiraCounts).sort((a, b) => b[1] - a[1]);
    const maxVal = Math.max(...entries.map(([, v]) => v));
    const barHeight = 28;
    const gap = 14;
    const padding = { left: 110, right: 40, top: 20 };
    const chartWidth = canvas.width - padding.left - padding.right;

    const colors = ['#6366f1', '#8b5cf6', '#3b82f6', '#22d3ee', '#f472b6'];

    entries.forEach(([label, count], i) => {
        const y = padding.top + (barHeight + gap) * i;
        const w = (count / maxVal) * chartWidth;

        // Bar
        const grad = ctx.createLinearGradient(padding.left, 0, padding.left + w, 0);
        grad.addColorStop(0, colors[i % colors.length]);
        grad.addColorStop(1, colors[i % colors.length] + '88');
        
        roundedRect(ctx, padding.left, y, w, barHeight, 6);
        ctx.fillStyle = grad;
        ctx.fill();

        // Label
        ctx.fillStyle = '#f0f0f5';
        ctx.font = '12px Inter';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, padding.left - 12, y + barHeight / 2);

        // Value 
        ctx.fillStyle = '#9ca3af';
        ctx.textAlign = 'left';
        ctx.fillText(count, padding.left + w + 8, y + barHeight / 2);
    });
}

function renderKPIs() {
    const ganhos = chargebacks.filter(c => c.status === 'ganho');
    const resolvidos = chargebacks.filter(c => ['ganho', 'perdido'].includes(c.status));
    const taxaRecuperacao = resolvidos.length > 0 ? (ganhos.length / resolvidos.length) * 100 : 0;
    
    const atuais = chargebacks.filter(c => !['ganho', 'perdido'].includes(c.status));
    const dentroPrazo = atuais.filter(c => new Date(c.prazo) > new Date()).length;
    const taxaPrazo = atuais.length > 0 ? (dentroPrazo / atuais.length) * 100 : 0;

    const tempoMedio = 14; // simulated
    const volumeMensal = chargebacks.length;

    animateKPIRing('kpi-progress-taxa', 'kpi-value-taxa', taxaRecuperacao, '%');
    animateKPIRing('kpi-progress-prazo', 'kpi-value-prazo', taxaPrazo, '%');
    animateKPIRing('kpi-progress-tempo', 'kpi-value-tempo', (tempoMedio / 30) * 100, 'd', tempoMedio);
    animateKPIRing('kpi-progress-volume', 'kpi-value-volume', Math.min((volumeMensal / 50) * 100, 100), '', volumeMensal);
}

function animateKPIRing(progressId, valueId, percentage, suffix, displayValue) {
    const circumference = 326.73;
    const progress = document.getElementById(progressId);
    const valueEl = document.getElementById(valueId);
    
    if (!progress || !valueEl) return;

    const offset = circumference - (percentage / 100) * circumference;
    
    setTimeout(() => {
        progress.style.strokeDashoffset = offset;
        if (displayValue !== undefined) {
            valueEl.textContent = displayValue + suffix;
        } else {
            valueEl.textContent = Math.round(percentage) + suffix;
        }
    }, 300);
}

// ============================================
// HELPERS
// ============================================
function getStatusBadge(status) {
    return `<span class="status-badge ${status}"><span class="dot"></span>${STATUS_LABELS[status]}</span>`;
}

function getPrazoDisplay(prazo) {
    const now = new Date();
    const diff = Math.ceil((new Date(prazo) - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `<span style="color: var(--red-400); font-weight: 600;">Vencido (${Math.abs(diff)}d)</span>`;
    if (diff <= 3) return `<span style="color: var(--orange-400); font-weight: 600;">${diff} dia${diff !== 1 ? 's' : ''}</span>`;
    return `<span style="color: var(--text-secondary);">${diff} dias</span>`;
}

function getEtapaDisplay(status) {
    const steps = ['recebido', 'em-analise', 'em-disputa', 'ganho'];
    const idx = steps.indexOf(status);
    const step = idx >= 0 ? idx + 1 : (status === 'perdido' ? 4 : 1);
    return `<span style="color: var(--text-muted); font-size: 0.8rem;">Etapa ${step}/4</span>`;
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR');
}

// ============================================
// CASE ACTIONS
// ============================================
function advanceCase(id) {
    const cb = chargebacks.find(c => c.id === id);
    if (!cb) return;

    const nextStatus = {
        'recebido': 'em-analise',
        'em-analise': 'em-disputa',
        'em-disputa': 'ganho'
    };

    const next = nextStatus[cb.status];
    if (!next) return;

    const actionTexts = {
        'em-analise': 'Caso movido para análise. Coleta de evidências iniciada.',
        'em-disputa': 'Defesa preparada e enviada à bandeira do cartão.',
        'ganho': 'Disputa finalizada com sucesso. Valor recuperado.'
    };

    cb.status = next;
    cb.historico.push({
        data: new Date(),
        texto: actionTexts[next]
    });

    // Add notification
    notifications.unshift({
        id: Date.now(),
        type: next === 'ganho' ? 'success' : 'info',
        icon: next === 'ganho' ? '✅' : 'ℹ️',
        title: `Status Atualizado`,
        text: `${cb.id} movido para "${STATUS_LABELS[next]}"`,
        time: 'Agora',
        unread: true
    });
    updateNotificationBadge();

    showToast('success', `${cb.id} avançou para "${STATUS_LABELS[next]}"`);

    // Refresh current page
    const activePage = document.querySelector('.page.active');
    if (activePage) {
        if (activePage.id === 'page-dashboard') renderDashboard();
        if (activePage.id === 'page-casos') renderCasesTable();
        if (activePage.id === 'page-fluxo') renderFlowPipeline();
    }
}

function markAsLost(id) {
    const cb = chargebacks.find(c => c.id === id);
    if (!cb) return;

    cb.status = 'perdido';
    cb.historico.push({
        data: new Date(),
        texto: 'Disputa perdida. Débito confirmado.'
    });

    notifications.unshift({
        id: Date.now(),
        type: 'danger',
        icon: '❌',
        title: 'Disputa Perdida',
        text: `${cb.id} — débito de R$ ${cb.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} confirmado.`,
        time: 'Agora',
        unread: true
    });
    updateNotificationBadge();

    showToast('error', `${cb.id} marcado como perdido`);
    closeModal();

    const activePage = document.querySelector('.page.active');
    if (activePage) {
        if (activePage.id === 'page-dashboard') renderDashboard();
        if (activePage.id === 'page-casos') renderCasesTable();
        if (activePage.id === 'page-fluxo') renderFlowPipeline();
    }
}

// ============================================
// MODAL
// ============================================
function openCaseDetail(id) {
    const cb = chargebacks.find(c => c.id === id);
    if (!cb) return;

    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const footer = document.getElementById('modal-footer');

    title.textContent = `Chargeback ${cb.id}`;

    body.innerHTML = `
        <div class="detail-grid">
            <div class="detail-group">
                <div class="detail-label">Cliente</div>
                <div class="detail-value">${cb.cliente.nome}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">E-mail</div>
                <div class="detail-value">${cb.cliente.email}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">CPF</div>
                <div class="detail-value">${cb.cliente.cpf}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Telefone</div>
                <div class="detail-value">${cb.cliente.telefone}</div>
            </div>
        </div>
        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 18px 0;">
        <div class="detail-grid">
            <div class="detail-group">
                <div class="detail-label">ID Transação</div>
                <div class="detail-value">${cb.transacao.id}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Valor</div>
                <div class="detail-value" style="font-weight: 700; font-size: 1.1rem;">R$ ${cb.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Bandeira</div>
                <div class="detail-value">${BANDEIRAS_MAP[cb.transacao.bandeira]}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Data Transação</div>
                <div class="detail-value">${formatDate(cb.transacao.data)}</div>
            </div>
        </div>
        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 18px 0;">
        <div class="detail-grid">
            <div class="detail-group">
                <div class="detail-label">Motivo</div>
                <div class="detail-value">${MOTIVOS_MAP[cb.motivo]}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Status</div>
                <div class="detail-value">${getStatusBadge(cb.status)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Data Recebimento</div>
                <div class="detail-value">${formatDate(cb.dataRecebimento)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">Prazo</div>
                <div class="detail-value">${formatDate(cb.prazo)} — ${getPrazoDisplay(cb.prazo)}</div>
            </div>
        </div>
        <hr style="border: none; border-top: 1px solid var(--border-color); margin: 18px 0;">
        <div class="detail-group">
            <div class="detail-label">Histórico</div>
            <div class="timeline">
                ${cb.historico.map(h => `
                    <div class="timeline-item">
                        <div class="timeline-date">${formatDate(h.data)}</div>
                        <div class="timeline-text">${h.texto}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Footer buttons
    if (cb.status !== 'ganho' && cb.status !== 'perdido') {
        footer.innerHTML = `
            <button class="btn btn-danger" onclick="markAsLost('${cb.id}')">Marcar como Perdido</button>
            <button class="btn btn-primary" onclick="advanceCase('${cb.id}'); closeModal();">Avançar Etapa</button>
        `;
    } else {
        footer.innerHTML = `<button class="btn btn-secondary" onclick="closeModal()">Fechar</button>`;
    }

    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
});

// ============================================
// NEW CHARGEBACK FORM
// ============================================
document.getElementById('btn-registrar')?.addEventListener('click', () => {
    const nome = document.getElementById('cliente-nome').value.trim();
    const email = document.getElementById('cliente-email').value.trim();
    const cpf = document.getElementById('cliente-cpf').value.trim();
    const telefone = document.getElementById('cliente-telefone').value.trim();
    const txnId = document.getElementById('transacao-id').value.trim();
    const valor = parseFloat(document.getElementById('transacao-valor').value);
    const dataTx = document.getElementById('transacao-data').value;
    const bandeira = document.getElementById('transacao-bandeira').value;
    const motivo = document.getElementById('cb-motivo').value;
    const codigo = document.getElementById('cb-codigo').value.trim();
    const dataRec = document.getElementById('cb-data-recebimento').value;
    const prazo = document.getElementById('cb-prazo').value;
    const descricao = document.getElementById('cb-descricao').value.trim();

    // Validation
    if (!nome || !valor || !motivo) {
        showToast('error', 'Preencha os campos obrigatórios: Nome, Valor e Motivo.');
        return;
    }

    const newId = `CB-${String(2025001 + chargebacks.length).padStart(7, '0')}`;
    const newCase = {
        id: newId,
        cliente: {
            nome,
            email: email || `${nome.toLowerCase().replace(/\s/g, '.')}@email.com`,
            cpf: cpf || generateCPF(),
            telefone: telefone || generatePhone()
        },
        transacao: {
            id: txnId || `TXN-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}`,
            valor: valor || 0,
            data: dataTx ? new Date(dataTx) : new Date(),
            bandeira: bandeira || 'visa'
        },
        motivo: motivo || 'outros',
        codigoMotivo: codigo || '',
        dataRecebimento: dataRec ? new Date(dataRec) : new Date(),
        prazo: prazo ? new Date(prazo) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'recebido',
        descricao,
        evidencias: uploadedFiles.map(f => f.name),
        historico: [{
            data: new Date(),
            texto: 'Chargeback registrado no sistema via formulário.'
        }]
    };

    chargebacks.unshift(newCase);

    // Auto-trigger workflow
    notifications.unshift({
        id: Date.now(),
        type: 'info',
        icon: '📋',
        title: 'Novo Chargeback Registrado',
        text: `${newId} — R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} registrado com sucesso.`,
        time: 'Agora',
        unread: true
    });
    updateNotificationBadge();

    showToast('success', `Chargeback ${newId} registrado com sucesso!`);

    // Clear form
    clearForm();

    // Auto-advance after 2s (simulate automation)
    setTimeout(() => {
        showToast('info', `🤖 Automação: ${newId} movido para análise automaticamente.`);
        const cb = chargebacks.find(c => c.id === newId);
        if (cb && cb.status === 'recebido') {
            cb.status = 'em-analise';
            cb.historico.push({
                data: new Date(),
                texto: 'Movido automaticamente para análise pelo sistema de automação.'
            });
            notifications.unshift({
                id: Date.now(),
                type: 'info',
                icon: '⚡',
                title: 'Automação Ativada',
                text: `${newId} movido automaticamente para "Em Análise".`,
                time: 'Agora',
                unread: true
            });
            updateNotificationBadge();
        }
    }, 3000);
});

function clearForm() {
    document.getElementById('cliente-nome').value = '';
    document.getElementById('cliente-email').value = '';
    document.getElementById('cliente-cpf').value = '';
    document.getElementById('cliente-telefone').value = '';
    document.getElementById('transacao-id').value = '';
    document.getElementById('transacao-valor').value = '';
    document.getElementById('transacao-data').value = '';
    document.getElementById('transacao-bandeira').value = '';
    document.getElementById('cb-motivo').value = '';
    document.getElementById('cb-codigo').value = '';
    document.getElementById('cb-data-recebimento').value = '';
    document.getElementById('cb-prazo').value = '';
    document.getElementById('cb-descricao').value = '';
    uploadedFiles = [];
    document.getElementById('uploaded-files').innerHTML = '';
}

document.getElementById('btn-limpar')?.addEventListener('click', clearForm);

// ============================================
// FILE UPLOAD
// ============================================
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');

uploadArea?.addEventListener('click', () => fileInput?.click());

uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
});

uploadArea?.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
});

uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
});

fileInput?.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    Array.from(files).forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
            showToast('error', `${file.name} excede o limite de 10MB.`);
            return;
        }
        uploadedFiles.push(file);
    });
    renderUploadedFiles();
}

function renderUploadedFiles() {
    const container = document.getElementById('uploaded-files');
    if (!container) return;
    
    container.innerHTML = uploadedFiles.map((file, i) => `
        <div class="uploaded-file">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span>${file.name}</span>
            <button class="remove-file" onclick="removeFile(${i})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </div>
    `).join('');
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    renderUploadedFiles();
}

// ============================================
// NOTIFICATIONS
// ============================================
document.getElementById('notification-btn')?.addEventListener('click', () => {
    const panel = document.getElementById('notification-panel');
    panel.classList.toggle('active');
    renderNotifications();
});

document.getElementById('notification-clear')?.addEventListener('click', () => {
    notifications = [];
    renderNotifications();
    updateNotificationBadge();
});

function renderNotifications() {
    const list = document.getElementById('notification-list');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 40px;">Nenhuma notificação</p>';
        return;
    }

    list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.unread ? 'unread' : ''}" onclick="markNotificationRead(${n.id})">
            <div class="notification-icon ${n.type}">${n.icon}</div>
            <div class="notification-content">
                <div class="notification-title">${n.title}</div>
                <div class="notification-text">${n.text}</div>
                <div class="notification-time">${n.time}</div>
            </div>
        </div>
    `).join('');
}

function markNotificationRead(id) {
    const notif = notifications.find(n => n.id === id);
    if (notif) notif.unread = false;
    renderNotifications();
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    const count = notifications.filter(n => n.unread).length;
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    }
}

// ============================================
// TOAST SYSTEM
// ============================================
function showToast(type, message) {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type]}</span>
        <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// CSV EXPORT
// ============================================
document.getElementById('btn-exportar')?.addEventListener('click', () => {
    const headers = ['ID', 'Cliente', 'Email', 'CPF', 'Valor', 'Motivo', 'Bandeira', 'Status', 'Data Recebimento', 'Prazo'];
    const rows = chargebacks.map(c => [
        c.id,
        c.cliente.nome,
        c.cliente.email,
        c.cliente.cpf,
        c.transacao.valor.toFixed(2),
        MOTIVOS_MAP[c.motivo],
        BANDEIRAS_MAP[c.transacao.bandeira],
        STATUS_LABELS[c.status],
        formatDate(c.dataRecebimento),
        formatDate(c.prazo)
    ]);

    let csv = headers.join(';') + '\n';
    rows.forEach(row => {
        csv += row.map(v => `"${v}"`).join(';') + '\n';
    });

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `chargebacks_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showToast('success', 'Relatório CSV exportado com sucesso!');
});

// "Ver todos" button
document.getElementById('btn-ver-todos')?.addEventListener('click', () => {
    navigateToPage('casos');
});

// ============================================
// WINDOW RESIZE
// ============================================
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        const activePage = document.querySelector('.page.active');
        if (activePage?.id === 'page-dashboard') {
            renderTimelineChart();
            renderReasonsChart();
        }
        if (activePage?.id === 'page-relatorios') renderReports();
    }, 200);
});

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
    const panel = document.getElementById('notification-panel');
    const btn = document.getElementById('notification-btn');
    if (panel?.classList.contains('active') && !panel.contains(e.target) && !btn.contains(e.target)) {
        panel.classList.remove('active');
    }
});

// ============================================
// INIT
// ============================================
function init() {
    updateNotificationBadge();
    renderDashboard();
}

init();
