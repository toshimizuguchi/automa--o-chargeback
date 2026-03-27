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

// Variáveis Globais (Expostas no window para acesso entre scripts)
window.chargebacks = [];
window.notifications = [];
window.uploadedFiles = [];

// Configuração de API (Prioriza localStorage, depois ambiente local ou padrão)
function getApiRoot() {
    var config = JSON.parse(localStorage.getItem('chargeguard_config') || '{}');
    if (config.backendUrl && config.backendUrl.trim() !== '') {
        return config.backendUrl.trim().replace(/\/$/, ''); // Remove barra final se houver
    }
    return (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://127.0.0.1:8000'
        : window.location.origin; // Assume mesmo domínio por padrão no Vercel
}

var API_ROOT = getApiRoot();

// Função para Sync Manual do Banco de Dados
async function syncFromDatabase() {
    console.log("Iniciando Sincronização...");
    var btn = document.getElementById('btn-sync-now');
    if (!btn) return;

    var originalText = btn.innerHTML;
    try {
        btn.innerHTML = '🔄 Sincronizando...';
        btn.classList.add('loading');

        // Re-valida API_ROOT antes da chamada
        API_ROOT = getApiRoot();
        var url = API_ROOT + '/api/chargebacks/';
        console.log("Buscando dados em:", url);

        // Obtém o token de segurança das configurações
        var config = JSON.parse(localStorage.getItem('chargeguard_config') || '{}');
        var token = config.cgToken || '';

        var response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-API-Key': token,
                'Content-Type': 'application/json'
            }
        });
        if (!response.ok) throw new Error("Erro de conexão (HTTP " + response.status + "): Verifique o Token de Segurança.");
        
        var dadosReais = await response.json();
        console.log("Dados carregados com sucesso!");

        // Atribui à variável global
        window.chargebacks = dadosReais;
        
        if (typeof showToast === 'function') {
            showToast('success', dadosReais.length + ' casos sincronizados do banco!');
        }
        
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderCasesTable === 'function') renderCasesTable();
        
    } catch (error) {
        console.error("Erro fatal no sync:", error);
        if (typeof showToast === 'function') {
            showToast('error', 'Erro ao conectar com o banco de dados.');
        } else {
            alert('Erro de conexão: Verifique seu servidor local.');
        }
    } finally {
        btn.innerHTML = originalText;
        btn.classList.remove('loading');
    }
}

// Tornar funções globais para o HTML
window.openManualModal = function() {
    console.log("Abrindo modal manual...");
    var modal = document.getElementById('modal-manual');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
};

window.salvarNovaEntrada = function() {
    console.log("Processando nova entrada manual...");
    var nomeEl = document.getElementById('manual-nome');
    var valorEl = document.getElementById('manual-valor');
    var consentimento = document.getElementById('manual-consentimento');
    if (!nomeEl || !valorEl || !nomeEl.value || !valorEl.value) {
        if (typeof showToast === 'function') showToast('warning', 'Preencha nome e valor!');
        return;
    }

    if (!consentimento || !consentimento.checked) {
        if (typeof showToast === 'function') showToast('error', 'Você deve aceitar o processamento de dados (LGPD)!');
        return;
    }

    var novoCb = {
        id: 'CB-' + Date.now().toString().slice(-7),
        cliente: {
            nome: nomeEl.value,
            email: document.getElementById('manual-email').value || 'contato@cliente.com',
            cpf: '000.000.000-00',
            telefone: '(11) 99999-9999'
        },
        transacao: {
            id: document.getElementById('manual-txn').value || 'TXN-' + Math.floor(Math.random() * 900000),
            valor: parseFloat(valorEl.value),
            data: new Date(),
            bandeira: 'visa'
        },
        motivo: document.getElementById('manual-motivo').value,
        dataRecebimento: new Date(),
        prazo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'recebido',
        historico: [{ data: new Date(), texto: 'Entrada manual registrada.' }]
    };

    if (window.chargebacks) {
        window.chargebacks.unshift(novoCb);
        if (typeof showToast === 'function') showToast('success', 'Caso adicionado com sucesso!');
        if (typeof renderDashboard === 'function') renderDashboard();
        if (typeof renderCasesTable === 'function') renderCasesTable();
    }

    var modal = document.getElementById('modal-manual');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    var form = document.getElementById('form-nova-entrada');
    if (form) form.reset();
};

window.fecharManualModal = function() {
    console.log("Fechando modal manual...");
    var modal = document.getElementById('modal-manual');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
};

// Inicialização segura
document.addEventListener('DOMContentLoaded', function() {
    console.log("ChargeGuard App Inicializado!");
    
    // Adiciona listener via delegação de eventos
    document.addEventListener('click', function(e) {
        const target = e.target;
        
        // 1. Botão de Sync
        if (target.id === 'btn-sync-now' || target.closest('#btn-sync-now')) {
            console.log("Botão de Sync detectado e clicado!");
            syncFromDatabase();
            return;
        }

        // 2. Abrir Modal de Nova Entrada
        if (target.id === 'btn-nova-entrada' || target.closest('#btn-nova-entrada')) {
            console.log("Botão Nova Entrada clicado!");
            window.openManualModal();
            return;
        }

        // 3. Fechar Modal (botão X ou Cancelar)
        if (target.id === 'modal-close-manual' || target.closest('#modal-close-manual') || 
            target.id === 'btn-cancelar-manual' || target.closest('#btn-cancelar-manual')) {
            window.fecharManualModal();
            return;
        }

        // 4. Exportação Excel (Controle de Operações)
        if (target.id === 'btn-export-excel' || target.closest('#btn-export-excel')) {
            window.exportToExcel();
            return;
        }
    });

    var btnSalvar = document.getElementById('btn-salvar-manual');
    if (btnSalvar) {
        btnSalvar.onclick = window.salvarNovaEntrada;
    }

    // Inicializar listeners dos filtros e busca
    initCasesListeners();
    // Inicializar listeners do Dashboard (Gráficos)
    initDashboardListeners();
});

// ============================================
// SAMPLE DATA GENERATORS
// ============================================
// Excluídos Geradores de Dados de Exemplo (Soliticação do Usuário)


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
    const total = window.chargebacks.length;
    const emDisputa = window.chargebacks.filter(c => c.status === 'em-disputa').length;
    const ganhos = window.chargebacks.filter(c => c.status === 'ganho');
    const valorRecuperado = ganhos.reduce((sum, c) => sum + c.transacao.valor, 0);
    const resolvidos = window.chargebacks.filter(c => ['ganho', 'perdido'].includes(c.status));
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

let currentTimelineDays = 7;

function renderTimelineChart(daysCount = currentTimelineDays) {
    currentTimelineDays = daysCount;
    const canvas = document.getElementById('timeline-chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    
    // Configuração de HiDPI para nitidez premium
    const dpr = window.devicePixelRatio || 1;
    canvas.width = (rect.width - 44) * dpr;
    canvas.height = 250 * dpr;
    canvas.style.width = `${rect.width - 44}px`;
    canvas.style.height = `250px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, 250);

    const days = [];
    const values = [];
    const now = new Date();
    const step = daysCount > 30 ? 10 : (daysCount > 7 ? 4 : 1);

    for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayLabel = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
        if (i % step === 0 || i === 0 || i === daysCount - 1) {
            days.push(dayLabel);
        } else {
            days.push("");
        }
        
        const count = window.chargebacks.filter(c => {
            if (!c.dataRecebimento) return false;
            const dateC = new Date(c.dataRecebimento);
            return dateC.getDate() === d.getDate() && 
                   dateC.getMonth() === d.getMonth() && 
                   dateC.getFullYear() === d.getFullYear();
        }).length;
        values.push(count);
    }

    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartWidth = (canvas.width / dpr) - padding.left - padding.right;
    const chartHeight = (canvas.height / dpr) - padding.top - padding.bottom;
    const maxVal = Math.max(...values, 5) + 2;

    // Grid Glow
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        ctx.fillStyle = '#6b7280';
        ctx.font = '500 11px Inter';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), padding.left - 12, y + 4);
    }

    // Modern Gradient
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    const points = values.map((v, i) => ({
        x: padding.left + (chartWidth / (values.length - 1)) * i,
        y: padding.top + chartHeight - (v / maxVal) * chartHeight
    }));

    // Glow Effect
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';

    // Main Line (Bezier)
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        const cp1x = (points[i - 1].x + points[i].x) / 2;
        ctx.bezierCurveTo(cp1x, points[i - 1].y, cp1x, points[i].y, points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Remove shadows for fill
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(points[0].x, padding.top + chartHeight);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Labels & Interactions
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    days.forEach((day, i) => {
        if (day) {
            const x = padding.left + (chartWidth / (days.length - 1)) * i;
            ctx.fillText(day, x, padding.top + chartHeight + 25);
            
            // Marker
            ctx.beginPath();
            ctx.arc(points[i].x, points[i].y, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#6366f1';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    });

    // Tooltip interativo simulado
    canvas.title = "Dados reais sincronizados do banco de dados.";
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
    window.chargebacks.forEach(c => {
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

function initDashboardListeners() {
    // Listeners para os botões de período do gráfico de Timeline
    document.querySelectorAll('.chart-btn[data-period]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            // Remove active de todos os botões do mesmo grupo
            btn.parentElement.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Extrai o número de dias do data-period (ex: "30d" -> 30)
            const days = parseInt(btn.dataset.period);
            renderTimelineChart(days);
        });
    });
}

function renderRecentCases() {
    const tbody = document.getElementById('recent-cases-body');
    if (!tbody) return;
    
    const recent = window.chargebacks.slice(0, 5);
    tbody.innerHTML = recent.map(c => `
        <tr>
            <td><span style="color: var(--indigo-400); font-weight: 600;">${c.id}</span></td>
            <td>${maskName(c.cliente.nome)}</td>
            <td><strong>R$ ${c.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
            <td>${MOTIVOS_MAP[c.motivo] || c.motivo}</td>
            <td>${getStatusBadge(c.status)}</td>
            <td>${getPrazoDisplay(c.prazo)}</td>
            <td>
                <button class="action-btn" onclick="openCaseDetail('${c.id}')" title="Ver detalhes">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
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
    tbody.innerHTML = ''; // Limpa antes de renderizar

    let filtered = window.chargebacks;
    if (filter !== 'todos') {
        filtered = window.chargebacks.filter(c => c.status === filter);
    }

    var searchEl = document.getElementById('search-input');
    var searchTerm = searchEl ? searchEl.value.toLowerCase() : '';
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
                    <span>${maskName(c.cliente.nome)}</span>
                    <span style="font-size: 0.72rem; color: var(--text-muted);">${maskEmail(c.cliente.email)}</span>
                </div>
            </td>
            <td><strong>R$ ${c.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
            <td>${MOTIVOS_MAP[c.motivo] || c.motivo}</td>
            <td>${BANDEIRAS_MAP[c.transacao.bandeira] || c.transacao.bandeira}</td>
            <td>${getStatusBadge(c.status)}</td>
            <td>
                <div class="proof-indicator">
                    <div class="proof-bar"><div class="proof-bar-fill low" style="width: 0%"></div></div>
                    <span class="proof-text">0%</span>
                </div>
            </td>
            <td>${getPrazoDisplay(c.prazo)}</td>
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

// Filter chips, Search e Select All — inicializados no DOMContentLoaded abaixo
function initCasesListeners() {
    document.querySelectorAll('.chip[data-filter]').forEach(function(chip) {
        chip.addEventListener('click', function() {
            document.querySelectorAll('.chip[data-filter]').forEach(function(c) { c.classList.remove('active'); });
            chip.classList.add('active');
            renderCasesTable(chip.dataset.filter);
        });
    });

    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            if (document.getElementById('page-casos').classList.contains('active')) {
                renderCasesTable();
            }
        });
    }

    var selectAll = document.getElementById('select-all');
    if (selectAll) {
        selectAll.addEventListener('change', function(e) {
            document.querySelectorAll('.case-checkbox').forEach(function(cb) { cb.checked = e.target.checked; });
        });
    }
}

// ============================================
// FLOW PIPELINE
// ============================================
function renderFlowPipeline() {
    const stages = {
        'recebido': window.chargebacks.filter(c => c.status === 'recebido'),
        'analise': window.chargebacks.filter(c => c.status === 'em-analise'),
        'disputa': window.chargebacks.filter(c => c.status === 'em-disputa'),
        'resolucao': window.chargebacks.filter(c => c.status === 'ganho' || c.status === 'perdido')
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
    const currentYear = new Date().getFullYear();
    const received = months.map((_, mIdx) => {
        return window.chargebacks.filter(c => {
            const d = new Date(c.dataRecebimento);
            return d.getMonth() === mIdx && d.getFullYear() === currentYear;
        }).length;
    });
    const won = months.map((_, mIdx) => {
        return window.chargebacks.filter(c => {
            const d = new Date(c.dataRecebimento);
            return d.getMonth() === mIdx && d.getFullYear() === currentYear && c.status === 'ganho';
        }).length;
    });

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

    // Calcula tempo médio real baseado no histórico (aprox)
    let tempoMedio = 0;
    const resolvidosComTempo = window.chargebacks.filter(c => ['ganho', 'perdido'].includes(c.status) && c.historico.length > 1);
    if (resolvidosComTempo.length > 0) {
        const totalDias = resolvidosComTempo.reduce((acc, c) => {
            const start = new Date(c.dataRecebimento);
            const end = new Date(c.historico[c.historico.length - 1].data);
            return acc + (end - start) / (1000 * 60 * 60 * 24);
        }, 0);
        tempoMedio = Math.round(totalDias / resolvidosComTempo.length);
    }
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
    const label = STATUS_LABELS[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Recebido');
    return `<span class="status-badge ${status}"><span class="dot"></span>${label}</span>`;
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

// LGPD Helpers: Mascaramento de dados para privacidade
function maskCPF(cpf) {
    if (!cpf) return "---.---.----**";
    // Formato: 123.***.***-**
    return cpf.substring(0, 4) + "***.***-**";
}

function maskEmail(email) {
    if (!email) return "*****@***.com";
    const [user, domain] = email.split('@');
    if (!domain) return email;
    // Formato: v****@origem.com
    return user.substring(0, 1) + "****@" + domain;
}

function maskName(name) {
    if (!name) return "Cliente Anônimo";
    const parts = name.split(' ');
    // Exibe apenas o primeiro nome e a inicial do último
    if (parts.length > 1) return parts[0] + " " + parts[parts.length - 1][0] + ".";
    return parts[0];
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
                <div class="detail-value">${maskName(cb.cliente.nome)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">E-mail</div>
                <div class="detail-value">${maskEmail(cb.cliente.email)}</div>
            </div>
            <div class="detail-group">
                <div class="detail-label">CPF</div>
                <div class="detail-value">${maskCPF(cb.cliente.cpf)}</div>
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
// EXPORT SYSTEM (EXCEL/CSV)
// ============================================
window.exportToExcel = function() {
    const headers = ['ID', 'Data Cadastro', 'Cliente', 'Email', 'Valor', 'Bandeira', 'Motivo', 'Status'];
    const rows = window.chargebacks.map(c => [
        c.id,
        c.dataRecebimento ? new Date(c.dataRecebimento).toLocaleDateString('pt-BR') : 'N/A',
        c.cliente.nome,
        c.cliente.email,
        c.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
        c.transacao.bandeira.toUpperCase(),
        c.motivo,
        STATUS_LABELS[c.status] || c.status
    ]);

    // Usando ponto e vírgula e BOM para total compatibilidade com Excel PT-BR
    let csvContent = "\uFEFF"; 
    csvContent += headers.join(";") + "\r\n";

    rows.forEach(row => {
        const escapedRow = row.map(val => `"${String(val).replace(/"/g, '""')}"`);
        csvContent += escapedRow.join(";") + "\r\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    
    link.setAttribute('href', url);
    link.setAttribute('download', `chargeguard_relatorio_${dateStr}.csv`);
    link.click();

    showToast('success', 'Relatório Excel exportado com sucesso!');
};

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
    
    // Inicia Sincronismo Automático se o Backend estiver acessível
    syncFromDatabase();
}

init();
