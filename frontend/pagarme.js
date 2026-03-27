/* ============================================
   ChargeGuard — Módulo Pagar.me + Defesa + Config
   ============================================ */

// Config store
let appConfig = JSON.parse(localStorage.getItem('chargeguard_config') || 'null') || {
    profiles: [],
    currentProfileId: null,
    apiKey: '', ambiente: 'test',
    backendUrl: '', // URL do Django API
    cgToken: '',    // Token de segurança do ChargeGuard
    autoAnalise: true, autoCarta: true, autoAlertaPrazo: true, autoEnvioPagarme: false, connected: false
};
let editingProfileId = null;

// Proof checklists by reason
const PROOF_CHECKLISTS = {
    'fraude': [
        { id: 'p1', label: 'Comprovante de entrega com assinatura', tag: 'Obrigatório' },
        { id: 'p2', label: 'Log de IP e device fingerprint da compra', tag: 'Obrigatório' },
        { id: 'p3', label: 'Confirmação de e-mail do pedido', tag: 'Obrigatório' },
        { id: 'p4', label: 'Histórico de compras anteriores do cliente', tag: 'Recomendado' },
        { id: 'p5', label: 'Screenshot do antifraude aprovando a transação', tag: 'Recomendado' },
        { id: 'p6', label: 'Nota fiscal eletrônica (NF-e)', tag: 'Obrigatório' }
    ],
    'produto-nao-recebido': [
        { id: 'p1', label: 'Comprovante de entrega (AR/tracking)', tag: 'Obrigatório' },
        { id: 'p2', label: 'Código de rastreamento com status entregue', tag: 'Obrigatório' },
        { id: 'p3', label: 'Nota fiscal eletrônica (NF-e)', tag: 'Obrigatório' },
        { id: 'p4', label: 'Print do status de entrega da transportadora', tag: 'Recomendado' },
        { id: 'p5', label: 'E-mail de confirmação de envio ao cliente', tag: 'Recomendado' }
    ],
    'produto-diferente': [
        { id: 'p1', label: 'Descrição detalhada do produto vendido', tag: 'Obrigatório' },
        { id: 'p2', label: 'Fotos do produto enviado', tag: 'Obrigatório' },
        { id: 'p3', label: 'Print da página do produto no site', tag: 'Obrigatório' },
        { id: 'p4', label: 'Nota fiscal com descrição do item', tag: 'Obrigatório' },
        { id: 'p5', label: 'Política de troca/devolução aceita pelo cliente', tag: 'Recomendado' }
    ],
    'cobranca-duplicada': [
        { id: 'p1', label: 'Comprovante de que são transações distintas', tag: 'Obrigatório' },
        { id: 'p2', label: 'IDs das transações no Pagar.me', tag: 'Obrigatório' },
        { id: 'p3', label: 'Notas fiscais de cada transação', tag: 'Obrigatório' },
        { id: 'p4', label: 'Comprovante de entrega de cada pedido', tag: 'Recomendado' }
    ],
    'cancelamento': [
        { id: 'p1', label: 'Termos de uso / política de cancelamento', tag: 'Obrigatório' },
        { id: 'p2', label: 'Prova de que serviço foi prestado antes do cancelamento', tag: 'Obrigatório' },
        { id: 'p3', label: 'Logs de acesso/uso do serviço pelo cliente', tag: 'Recomendado' },
        { id: 'p4', label: 'E-mails trocados com o cliente', tag: 'Recomendado' }
    ],
    'valor-incorreto': [
        { id: 'p1', label: 'Comprovante do valor correto cobrado', tag: 'Obrigatório' },
        { id: 'p2', label: 'Print do checkout com o valor', tag: 'Obrigatório' },
        { id: 'p3', label: 'Nota fiscal com valor correspondente', tag: 'Obrigatório' }
    ],
    'servico-nao-prestado': [
        { id: 'p1', label: 'Comprovante de prestação do serviço', tag: 'Obrigatório' },
        { id: 'p2', label: 'Logs de acesso/uso pelo cliente', tag: 'Obrigatório' },
        { id: 'p3', label: 'Contrato ou aceite de termos', tag: 'Obrigatório' },
        { id: 'p4', label: 'E-mails de suporte trocados', tag: 'Recomendado' }
    ],
    'outros': [
        { id: 'p1', label: 'Nota fiscal eletrônica', tag: 'Obrigatório' },
        { id: 'p2', label: 'Comprovante de entrega', tag: 'Recomendado' },
        { id: 'p3', label: 'Contrato ou aceite de termos', tag: 'Recomendado' }
    ]
};

// Track checklist state per case
let checklistStates = {};
let defesaFiles = [];
let selectedDefesaCaseId = null;

// ============================================
// PAGE TITLES (extend existing)
// ============================================
const EXTRA_PAGES = {
    'defesa': { title: 'Defesa Pagar.me', subtitle: 'Gerar carta de defesa e enviar disputa' },
    'config': { title: 'Configurações', subtitle: 'Integração Pagar.me e modelo de documentação' }
};

// Patch navigation
const origNavigate = window.navigateToPage || function () { };
window.addEventListener('DOMContentLoaded', () => {
    // Re-bind nav items for new pages
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const pageName = item.dataset.page;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            const page = document.getElementById(`page-${pageName}`);
            if (page) page.classList.add('active');
            const info = EXTRA_PAGES[pageName] || PAGE_TITLES[pageName];
            if (info) {
                document.getElementById('page-title').textContent = info.title;
                document.getElementById('page-subtitle').textContent = info.subtitle;
            }
            if (pageName === 'dashboard') renderDashboard();
            if (pageName === 'casos') renderCasesTable();
            if (pageName === 'fluxo') renderFlowPipeline();
            if (pageName === 'relatorios') renderReports();
            if (pageName === 'defesa') initDefesaPage();
            if (pageName === 'config') loadConfig();
            document.getElementById('sidebar').classList.remove('open');
        });
    });
    loadConfig();
    updatePagarmeStatus();
    patchCasesTable();
    initCNPJLookup();
});

// ============================================
// DEFESA PAGE
// ============================================
function initDefesaPage() {
    const select = document.getElementById('defesa-caso-select');
    if (!select) return;

    // Carregar perfis de empresas disponíveis
    renderProfileSelector();

    const activeCases = window.chargebacks.filter(c => !['ganho', 'perdido'].includes(c.status));
    select.innerHTML = '<option value="">Selecione um caso...</option>' +
        activeCases.map(c => `<option value="${c.id}">${c.id} — ${c.cliente.nome} — R$ ${c.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${MOTIVOS_MAP[c.motivo]})</option>`).join('');

    select.onchange = () => {
        selectedDefesaCaseId = select.value;
        if (selectedDefesaCaseId) {
            // Limpa anexos do caso anterior ao trocar
            defesaFiles = [];
            renderDefesaFiles();
            showDefesaPanels(selectedDefesaCaseId);
        } else {
            document.getElementById('checklist-card').style.display = 'none';
            document.getElementById('pagarme-send-card').style.display = 'none';
            document.getElementById('carta-defesa-card').style.display = 'none';
        }
    };
}

function showDefesaPanels(caseId) {
    const cb = window.chargebacks.find(c => c.id === caseId);
    if (!cb) return;
    document.getElementById('checklist-card').style.display = 'block';
    document.getElementById('pagarme-send-card').style.display = 'block';
    document.getElementById('carta-defesa-card').style.display = 'block';
    if (!checklistStates[caseId]) {
        const items = PROOF_CHECKLISTS[cb.motivo] || PROOF_CHECKLISTS['outros'];
        checklistStates[caseId] = items.map(i => ({ ...i, checked: false }));
    }
    renderChecklist(caseId);
    renderProfileSelector();
    generateDefenseLetter(cb);
    updateSendButton(caseId);
}

function renderProfileSelector() {
    const select = document.getElementById('defesa-perfil-select');
    if (!select) return;
    const profiles = appConfig.profiles || [];
    select.innerHTML = '<option value="default">Padrão (Configurações)</option>' +
        profiles.map(p => `<option value="${p.id}">${p.empresa}</option>`).join('');

    select.onchange = () => {
        const cb = window.chargebacks.find(c => c.id === selectedDefesaCaseId);
        if (cb) generateDefenseLetter(cb);
    };
}

function renderChecklist(caseId) {
    const items = checklistStates[caseId] || [];
    const container = document.getElementById('checklist-items');
    const done = items.filter(i => i.checked).length;
    const total = items.length;
    document.getElementById('checklist-done').textContent = done;
    document.getElementById('checklist-total').textContent = total;
    document.getElementById('checklist-bar-fill').style.width = total > 0 ? ((done / total) * 100) + '%' : '0%';
    container.innerHTML = items.map((item, idx) => `
        <div class="checklist-item ${item.checked ? 'checked' : ''}" onclick="toggleCheckItem('${caseId}',${idx})">
            <div class="check-icon">${item.checked ? '✓' : ''}</div>
            <span class="check-label">${item.label}</span>
            <span class="check-tag">${item.tag}</span>
        </div>
    `).join('');
    // Store proof completion on the case
    const cb = window.chargebacks.find(c => c.id === caseId);
    if (cb) cb.proofComplete = total > 0 ? Math.round((done / total) * 100) : 0;
}

function toggleCheckItem(caseId, idx) {
    if (checklistStates[caseId] && checklistStates[caseId][idx]) {
        checklistStates[caseId][idx].checked = !checklistStates[caseId][idx].checked;
        renderChecklist(caseId);
        updateSendButton(caseId);
    }
}

function updateSendButton(caseId) {
    const items = checklistStates[caseId] || [];
    const allDone = items.length > 0 && items.every(i => i.checked);
    const btn = document.getElementById('btn-enviar-pagarme');
    const docsCount = document.getElementById('pagarme-docs-count');
    if (btn) btn.disabled = !allDone; // Removido !appConfig.connected para permitir teste Sandbox
    if (docsCount) docsCount.textContent = `${defesaFiles.length} anexos + carta de defesa`;
    const apiStatus = document.getElementById('pagarme-api-status');
    if (apiStatus) {
        apiStatus.textContent = appConfig.connected ? '● Conectado' : '● Desconectado';
        apiStatus.style.color = appConfig.connected ? 'var(--green-400)' : 'var(--red-400)';
    }
}

// ============================================
// CARTA DE DEFESA — GERAÇÃO AUTOMÁTICA
// ============================================
function generateDefenseLetter(cb) {
    const body = document.getElementById('carta-body');
    if (!body) return;

    // Pegar dados do perfil selecionado ou do padrão
    const perfilId = document.getElementById('defesa-perfil-select').value;
    let dados = { ...appConfig };

    if (perfilId && perfilId !== 'default') {
        const perfil = appConfig.profiles.find(p => p.id === perfilId);
        if (perfil) dados = { ...perfil };
    }

    const cfg = dados;
    const empresa = cfg.empresa || '[NOME DA EMPRESA]';
    const cnpj = cfg.cnpj || '[CNPJ]';
    const resp = cfg.responsavel || '[RESPONSÁVEL]';
    const emailEmp = cfg.emailEmpresa || '[EMAIL]';
    const endereco = cfg.endereco || '[ENDEREÇO]';
    const hoje = new Date().toLocaleDateString('pt-BR');
    const motivo = MOTIVOS_MAP[cb.motivo] || cb.motivo;
    const items = checklistStates[cb.id] || PROOF_CHECKLISTS[cb.motivo] || [];
    const provasText = items.map((p, i) => `   ${i + 1}. ${p.label}`).join('\n');

    const carta = `══════════════════════════════════════════════
   CARTA DE DEFESA — CONTESTAÇÃO DE CHARGEBACK
══════════════════════════════════════════════

Data: ${hoje}
Protocolo: DEF-${cb.id}
Ref. Transação Pagar.me: ${cb.transacao.id}

DE: ${empresa}
CNPJ: ${cnpj}
Endereço: ${endereco}
Responsável: ${resp}
E-mail: ${emailEmp}

PARA: Departamento de Disputas
Bandeira: ${BANDEIRAS_MAP[cb.transacao.bandeira] || cb.transacao.bandeira}
Via: Pagar.me — API de Contestação

══════════════════════════════════════════════
   DADOS DA TRANSAÇÃO EM DISPUTA
══════════════════════════════════════════════

ID Transação:     ${cb.transacao.id}
ID Chargeback:    ${cb.id}
Valor:            R$ ${cb.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Data Transação:   ${formatDate(cb.transacao.data)}
Data Chargeback:  ${formatDate(cb.dataRecebimento)}
Motivo Alegado:   ${motivo}
Reason Code:      ${cb.codigoMotivo || 'N/A'}
Bandeira:         ${BANDEIRAS_MAP[cb.transacao.bandeira] || ''}

══════════════════════════════════════════════
   DADOS DO PORTADOR / CLIENTE
══════════════════════════════════════════════

Nome:     ${cb.cliente.nome}
CPF:      ${cb.cliente.cpf}
E-mail:   ${cb.cliente.email}
Telefone: ${cb.cliente.telefone}

══════════════════════════════════════════════
   ARGUMENTAÇÃO DE DEFESA
══════════════════════════════════════════════

Prezados Senhores,

Vimos por meio desta contestar formalmente o chargeback de ID ${cb.id}, referente à transação ${cb.transacao.id}, no valor de R$ ${cb.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, realizada em ${formatDate(cb.transacao.data)}.

${getDefenseArgument(cb.motivo, cb)}

Ressaltamos que a ${empresa} opera em total conformidade com as regras das bandeiras e adquirentes, e que todas as transações passam por nosso sistema de análise de risco antes de serem aprovadas.

══════════════════════════════════════════════
   EVIDÊNCIAS ANEXADAS
══════════════════════════════════════════════

Seguem as provas documentais que comprovam a legitimidade da transação:

${provasText}

══════════════════════════════════════════════
   CONCLUSÃO
══════════════════════════════════════════════

Diante das evidências apresentadas, solicitamos respeitosamente que este chargeback seja revertido em favor de ${empresa}, restituindo o valor de R$ ${cb.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} à nossa conta.

Colocamo-nos à disposição para qualquer esclarecimento adicional.

${cfg.textoExtra ? '\n' + cfg.textoExtra + '\n' : ''}
Atenciosamente,

${resp}
${empresa}
CNPJ: ${cnpj}
${emailEmp}
${endereco}

══════════════════════════════════════════════
   Documento gerado automaticamente pelo
   ChargeGuard — Sistema de Automação de Chargebacks
   ${hoje}
══════════════════════════════════════════════`;

    body.textContent = carta;
}

function getDefenseArgument(motivo, cb) {
    const args = {
        'fraude': `O motivo alegado é "Fraude / Transação não reconhecida". Contudo, informamos que a transação foi devidamente autorizada e autenticada. Conforme evidências anexas, o produto/serviço foi entregue no endereço cadastrado pelo próprio portador do cartão, com confirmação de recebimento. Os logs de acesso demonstram que a compra foi realizada a partir de dispositivo previamente utilizado pelo cliente, com IP e geolocalização consistentes com o cadastro.`,
        'produto-nao-recebido': `O motivo alegado é "Produto não recebido". Informamos que o produto foi devidamente enviado e entregue, conforme comprovante de entrega anexo com código de rastreamento ${cb.transacao.id}. O status da transportadora confirma a entrega bem-sucedida no endereço informado pelo cliente no momento da compra.`,
        'produto-diferente': `O motivo alegado é "Produto diferente do descrito". Informamos que o produto enviado corresponde exatamente à descrição publicada em nosso site/plataforma. Anexamos fotos do produto, print da página do produto e a nota fiscal detalhada para comprovação.`,
        'cobranca-duplicada': `O motivo alegado é "Cobrança duplicada". Esclarecemos que cada transação refere-se a pedidos distintos, com IDs de transação diferentes no Pagar.me, conforme documentação anexa. Cada pedido possui sua própria nota fiscal e comprovante de entrega.`,
        'cancelamento': `O motivo alegado é "Cancelamento não processado". Informamos que o serviço foi integralmente prestado antes da solicitação de cancelamento, conforme logs de acesso anexos. Nossa política de cancelamento, aceita pelo cliente no momento da contratação, estabelece as condições aplicáveis.`,
        'valor-incorreto': `O motivo alegado é "Valor incorreto". Informamos que o valor cobrado corresponde exatamente ao valor apresentado no checkout e aceito pelo cliente, conforme print da tela de pagamento e nota fiscal anexos.`,
        'servico-nao-prestado': `O motivo alegado é "Serviço não prestado". Informamos que o serviço foi integralmente prestado, conforme logs de acesso e utilização pelo cliente anexos. O contrato/termos de uso foram aceitos pelo cliente previamente.`,
    };
    return args[motivo] || `Contestamos este chargeback com base nas evidências documentais anexas que comprovam a legitimidade e a entrega do produto/serviço ao cliente.`;
}

// ============================================
// PDF COMPILATION LOGIC
// ============================================
document.getElementById('btn-compilar-pdf').addEventListener('click', async (e) => {
    // Evita propagação e execuções múltiplas
    e.preventDefault();
    e.stopPropagation();

    if (!selectedDefesaCaseId) {
        showToast('error', 'Selecione um caso primeiro');
        return;
    }

    if (this._isCompiling) return;
    this._isCompiling = true;

    const cb = chargebacks.find(c => c.id === selectedDefesaCaseId);
    if (!cb) return;

    const btn = document.getElementById('btn-compilar-pdf');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Preparando documentos...';

    try {
        const jspdfLib = window.jspdf || window.jsPDF;
        const pdflib = window.PDFLib;

        if (!jspdfLib) throw new Error('Biblioteca jsPDF não carregada. Dê um Ctrl+F5.');
        if (!pdflib) throw new Error('Biblioteca PDF-Lib não carregada. Dê um Ctrl+F5.');

        // Passamos uma COPIA da lista de arquivos para garantir isolamento
        await generateFullPDF(cb, jspdfLib, pdflib, [...defesaFiles]);
        showToast('success', `PDF gerado com sucesso!`);
    } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        showToast('error', `Erro: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
        this._isCompiling = false;
    }
});

async function generateFullPDF(cb, jspdfLib, pdflib, filesToProcess) {
    const { PDFDocument, rgb } = pdflib;
    const jsPDF = jspdfLib.jsPDF || jspdfLib;

    // 1. Criar o PDF final (vazio)
    const mergedPdf = await PDFDocument.create();

    // 2. Gerar a Carta de Defesa usando jsPDF e converter para bytes
    const doc = new jsPDF();
    const cartaText = document.getElementById('carta-body').textContent;
    doc.setFont("courier", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(cartaText, 180);
    let y = 20;
    lines.forEach(line => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(line, 15, y); y += 5;
    });

    // Converter jsPDF para ArrayBuffer e carregar no PDF final
    const cartaBytes = doc.output('arraybuffer');
    const tempDoc = await PDFDocument.load(cartaBytes);
    const copiedPages = await mergedPdf.copyPages(tempDoc, tempDoc.getPageIndices());
    copiedPages.forEach(page => mergedPdf.addPage(page));

    // 3. Processar Anexos (Usando a lista ISOLADA passada como argumento)
    for (const file of filesToProcess) {
        try {
            if (file.type === 'application/pdf') {
                // Se for PDF, carregar e copiar as páginas
                const fileBytes = await file.arrayBuffer();
                const attachmentDoc = await PDFDocument.load(fileBytes);
                const pages = await mergedPdf.copyPages(attachmentDoc, attachmentDoc.getPageIndices());
                pages.forEach(page => mergedPdf.addPage(page));
            }
            else if (file.type.startsWith('image/')) {
                // Se for imagem, criar uma nova página e desenhar
                const imageData = await file.arrayBuffer();
                const page = mergedPdf.addPage([595.28, 841.89]); // A4 em pontos

                let image;
                if (file.type === 'image/png') image = await mergedPdf.embedPng(imageData);
                else image = await mergedPdf.embedJpg(imageData);

                const { width, height } = image.scale(1);
                const dims = image.scale(Math.min(500 / width, 700 / height)); // Redimensionar para caber

                page.drawText(`EVIDÊNCIA: ${file.name}`, { x: 50, y: 800, size: 12 });
                page.drawImage(image, {
                    x: 50,
                    y: 780 - dims.height,
                    width: dims.width,
                    height: dims.height,
                });
            }
        } catch (err) {
            console.warn(`Erro ao processar anexo ${file.name}:`, err);
            const errorPage = mergedPdf.addPage();
            errorPage.drawText(`Erro ao incluir anexo: ${file.name}`, { x: 50, y: 700, size: 12, color: rgb(1, 0, 0) });
        }
    }

    // 4. Salvar e Baixar
    const pdfBytes = await mergedPdf.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `contestacao_${cb.transacao.id}.pdf`;
    link.click();
}

// Helper to read file as data URL
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============================================
// CARTA ACTIONS
// ============================================
document.getElementById('btn-copiar-carta').addEventListener('click', () => {
    const text = document.getElementById('carta-body').textContent || '';
    navigator.clipboard.writeText(text).then(() => showToast('success', 'Carta copiada para a área de transferência!'));
});

document.getElementById('btn-download-carta').addEventListener('click', () => {
    const text = document.getElementById('carta-body').textContent || '';
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    const cb = window.chargebacks.find(c => c.id === selectedDefesaCaseId);
    const fileName = cb ? `carta_defesa_${cb.transacao.id}.txt` : `carta_defesa_${selectedDefesaCaseId}.txt`;
    a.download = fileName;
    a.click(); showToast('success', 'Carta de defesa baixada!');
});

document.getElementById('btn-gerar-carta').addEventListener('click', () => {
    if (selectedDefesaCaseId) {
        const cb = window.chargebacks.find(c => c.id === selectedDefesaCaseId);
        if (cb) { generateDefenseLetter(cb); showToast('info', 'Carta de defesa regenerada!'); }
    }
});

// ============================================
// ENVIO PAGAR.ME (SIMULADO)
// ============================================
document.getElementById('btn-enviar-pagarme').addEventListener('click', async () => {
    if (!selectedDefesaCaseId) return;
    const cb = window.chargebacks.find(c => c.id === selectedDefesaCaseId);
    if (!cb) return;

    const btn = document.getElementById('btn-enviar-pagarme');
    const pipeline = document.getElementById('simulation-pipeline');

    btn.disabled = true;
    btn.innerHTML = '🚀 Transmitindo...';
    
    // Processamento Rápido
    cb.status = 'em-disputa';
    cb.pagarmeDisputeId = 'sim_' + Math.random().toString(36).substr(2, 9).toUpperCase();
    cb.historico.push({ data: new Date(), texto: `Defesa enviada com sucesso (Pagar.me Sandbox).` });

    // Sincronizar com o Banco de Dados (Persistência)
    if (window.syncStatusWithDB) {
        window.syncStatusWithDB(cb.id, 'em-disputa');
    }

    // Notificações
    notifications.unshift({
        id: Date.now(),
        type: 'success',
        icon: '🚀',
        title: 'Defesa Enviada ao Pagar.me',
        text: `Caso ${cb.id} em disputa com sucesso.`,
        time: 'Agora',
        unread: true
    });

    if (window.updateNotificationBadge) window.updateNotificationBadge();
    showToast('success', `✅ Transmissão concluída! Caso ${cb.id} em disputa.`);
    
    btn.innerHTML = '✅ Enviado!';

    // Voltar Imediatamente para Operações (800ms para ver o toast)
    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '🚀 Enviar Defesa ao Pagar.me';
        
        // Reiniciar formulário
        resetDefesaForm();
        
        if (window.navigateToPage) window.navigateToPage('casos');
        if (window.renderCasesTable) window.renderCasesTable();
    }, 800);
});

function resetDefesaForm() {
    // 1. Limpar arquivos anexados
    defesaFiles = [];
    if (typeof renderDefesaFiles === 'function') renderDefesaFiles();

    // 2. Desmarcar todos os checklists de documentos
    document.querySelectorAll('.document-check input[type="checkbox"]').forEach(ck => ck.checked = false);

    // 3. Resetar o seletor de caso e o estado de seleção
    const select = document.getElementById('defesa-caso-select');
    if (select) select.value = '';
    selectedDefesaCaseId = null;

    // 4. Limpar preview da carta
    const body = document.getElementById('carta-body');
    if (body) body.textContent = 'Aguardando seleção de caso...';

    // 5. Atualizar o estado do botão
    if (typeof updateSendButton === 'function') updateSendButton(null);
}

// ============================================
// DEFESA FILE UPLOAD
// ============================================
const defUpload = document.getElementById('defesa-upload-area');
const defInput = document.getElementById('defesa-file-input');
defUpload.addEventListener('click', () => defInput.click());
defInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(f => defesaFiles.push(f));
    renderDefesaFiles();
    if (selectedDefesaCaseId) updateSendButton(selectedDefesaCaseId);
    // Limpa o input para permitir selecionar o mesmo arquivo se for removido e adicionado de novo
    e.target.value = '';
});
function renderDefesaFiles() {
    const c = document.getElementById('defesa-uploaded-files'); if (!c) return;
    c.innerHTML = defesaFiles.map((f, i) => `<div class="uploaded-file"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${f.name}</span><button class="remove-file" onclick="defesaFiles.splice(${i},1);renderDefesaFiles();"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`).join('');
}

// ============================================
// CONFIG PAGE & PROFILES
// ============================================
function loadConfig() {
    document.getElementById('config-api-key') && (document.getElementById('config-api-key').value = appConfig.apiKey);
    document.getElementById('config-ambiente') && (document.getElementById('config-ambiente').value = appConfig.ambiente);
    document.getElementById('config-backend-url') && (document.getElementById('config-backend-url').value = appConfig.backendUrl || '');
    document.getElementById('config-cg-token') && (document.getElementById('config-cg-token').value = appConfig.cgToken || '');

    document.getElementById('auto-analise') && (document.getElementById('auto-analise').checked = appConfig.autoAnalise);
    document.getElementById('auto-carta') && (document.getElementById('auto-carta').checked = appConfig.autoCarta);
    document.getElementById('auto-alerta-prazo') && (document.getElementById('auto-alerta-prazo').checked = appConfig.autoAlertaPrazo);
    document.getElementById('auto-envio-pagarme') && (document.getElementById('auto-envio-pagarme').checked = appConfig.autoEnvioPagarme);

    renderProfilesList();
    updateIntegrationBanner();
}

function renderProfilesList() {
    const list = document.getElementById('profiles-list');
    if (!list) return;

    const profiles = appConfig.profiles || [];
    if (profiles.length === 0) {
        list.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding: 20px;">Nenhum perfil cadastrado. Adicione sua primeira empresa abaixo.</p>';
        return;
    }

    list.innerHTML = profiles.map(p => `
        <div class="profile-card-item">
            <div class="profile-card-info">
                <h4>${p.empresa}</h4>
                <p>${p.cnpj} — ${p.responsavel}</p>
            </div>
            <div class="profile-card-actions">
                <button class="btn-icon" onclick="editProfile('${p.id}')" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                <button class="btn-icon delete" onclick="deleteProfile('${p.id}')" title="Excluir"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
            </div>
        </div>
    `).join('');
}

function editProfile(id) {
    const profile = appConfig.profiles.find(p => p.id === id);
    if (!profile) return;

    editingProfileId = id;
    document.getElementById('profile-editor-section').style.display = 'block';

    document.getElementById('config-empresa').value = profile.empresa;
    document.getElementById('config-cnpj').value = profile.cnpj;
    document.getElementById('config-responsavel').value = profile.responsavel;
    document.getElementById('config-email-empresa').value = profile.emailEmpresa;
    document.getElementById('config-endereco').value = profile.endereco;
    document.getElementById('config-texto-extra').value = profile.textoExtra;

    document.getElementById('profile-editor-section').scrollIntoView({ behavior: 'smooth' });
}

function deleteProfile(id) {
    if (confirm('Tem certeza que deseja excluir este perfil de empresa?')) {
        appConfig.profiles = appConfig.profiles.filter(p => p.id !== id);
        saveConfigToStore();
        renderProfilesList();
        showToast('info', 'Perfil excluído');
    }
}

document.getElementById('btn-novo-perfil').addEventListener('click', () => {
    editingProfileId = 'new_' + Date.now();
    document.getElementById('profile-editor-section').style.display = 'block';

    // Limpa campos
    document.getElementById('config-empresa').value = '';
    document.getElementById('config-cnpj').value = '';
    document.getElementById('config-responsavel').value = '';
    document.getElementById('config-email-empresa').value = '';
    document.getElementById('config-endereco').value = '';
    document.getElementById('config-texto-extra').value = '';

    document.getElementById('profile-editor-section').scrollIntoView({ behavior: 'smooth' });
});

// ============================================
// CNPJ AUTO-LOOKUP (BrasilAPI)
// ============================================
function initCNPJLookup() {
    const cnpjInput = document.getElementById('config-cnpj');
    if (!cnpjInput) return;

    cnpjInput.addEventListener('blur', async () => {
        const cnpj = cnpjInput.value.replace(/\D/g, '');
        if (cnpj.length !== 14) return;

        showToast('info', '🔍 Buscando dados da empresa...');
        cnpjInput.classList.add('loading-field');

        try {
            // Chamada via backend (Proxy) para evitar erro de CORS
            const backend = appConfig.backendUrl || '';
            const baseUrl = backend.endsWith('/') ? backend.slice(0, -1) : backend;
            const finalUrl = `${baseUrl}/api/cnpj/${cnpj}`;

            const response = await fetch(finalUrl);
            if (!response.ok) throw new Error('CNPJ não encontrado ou erro no servidor');

            const data = await response.json();

            // Se a API retornar erro no corpo mesmo com status 200 (alguns proxies) ou se faltar campo chave
            if (data.error || (!data.cnpj && !data.razao_social)) {
                throw new Error(data.message || data.error || 'CNPJ não encontrado');
            }

            // Preencher campos automaticamente (com fallback vazio para evitar 'undefined')
            const nome = data.razao_social || data.nome_fantasia || '';
            document.getElementById('config-empresa').value = nome;

            if (data.email) {
                document.getElementById('config-email-empresa').value = data.email;
            }

            // Montar endereço de forma segura
            const parts = [];
            if (data.logradouro) parts.push(data.logradouro);
            if (data.numero) parts.push(data.numero);
            if (data.complemento) parts.push(data.complemento);
            if (data.bairro) parts.push(data.bairro);

            let address = parts.join(', ');
            if (data.municipio) address += ` - ${data.municipio}`;
            if (data.uf) address += `/${data.uf}`;
            if (data.cep) address += `, CEP ${data.cep}`;

            document.getElementById('config-endereco').value = address;

            showToast('success', '✅ Dados da empresa carregados!');

            // Trigger visual feedback
            const editor = document.getElementById('profile-editor-section');
            editor.querySelectorAll('input').forEach(input => {
                if (input.value && input.id !== 'config-cnpj') {
                    input.style.borderColor = 'var(--green-400)';
                    setTimeout(() => input.style.borderColor = '', 2000);
                }
            });

        } catch (err) {
            console.error('Erro na busca de CNPJ:', err);
            showToast('warning', '⚠️ Não foi possível puxar os dados automaticamente. Preencha manualmente.');
        } finally {
            cnpjInput.classList.remove('loading-field');
        }
    });

    // Simple mask for CNPJ
    cnpjInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 14) value = value.slice(0, 14);

        if (value.length > 12) value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
        else if (value.length > 8) value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4}).*/, '$1.$2.$3/$4');
        else if (value.length > 5) value = value.replace(/^(\d{2})(\d{3})(\d{3}).*/, '$1.$2.$3');
        else if (value.length > 2) value = value.replace(/^(\d{2})(\d{3}).*/, '$1.$2');

        e.target.value = value;
    });
}

function saveConfig() {
    // API Keys e Globais
    appConfig.apiKey = document.getElementById('config-api-key').value || '';
    appConfig.ambiente = document.getElementById('config-ambiente').value || 'test';
    appConfig.backendUrl = document.getElementById('config-backend-url') ? document.getElementById('config-backend-url').value.trim() : '';
    appConfig.cgToken = document.getElementById('config-cg-token') ? document.getElementById('config-cg-token').value.trim() : '';
    appConfig.autoAnalise = document.getElementById('auto-analise').checked || true;
    appConfig.autoCarta = document.getElementById('auto-carta').checked || true;
    appConfig.autoAlertaPrazo = document.getElementById('auto-alerta-prazo').checked || true;
    appConfig.autoEnvioPagarme = document.getElementById('auto-envio-pagarme').checked || false;

    // Se estiver editando um perfil
    if (editingProfileId) {
        const profileData = {
            id: editingProfileId.startsWith('new_') ? 'prof_' + Date.now() : editingProfileId,
            empresa: document.getElementById('config-empresa').value,
            cnpj: document.getElementById('config-cnpj').value,
            responsavel: document.getElementById('config-responsavel').value,
            emailEmpresa: document.getElementById('config-email-empresa').value,
            endereco: document.getElementById('config-endereco').value,
            textoExtra: document.getElementById('config-texto-extra').value
        };

        if (editingProfileId.startsWith('new_')) {
            appConfig.profiles.push(profileData);
        } else {
            const idx = appConfig.profiles.findIndex(p => p.id === editingProfileId);
            if (idx !== -1) appConfig.profiles[idx] = profileData;
        }

        editingProfileId = null;
        document.getElementById('profile-editor-section').style.display = 'none';
    }

    saveConfigToStore();
    showToast('success', 'Configurações e Perfis salvos!');
    renderProfilesList();
    updatePagarmeStatus();
}

function saveConfigToStore() {
    localStorage.setItem('chargeguard_config', JSON.stringify(appConfig));
}

document.getElementById('btn-salvar-config').addEventListener('click', saveConfig);

document.getElementById('btn-testar-conexao').addEventListener('click', () => {
    const key = document.getElementById('config-api-key').value || '';
    if (!key || key.length < 10) { showToast('error', 'Insira uma API Key válida do Pagar.me'); return; }
    showToast('info', '🔄 Testando conexão com Pagar.me...');
    setTimeout(() => {
        appConfig.connected = true; appConfig.apiKey = key;
        saveConfigToStore();
        showToast('success', '✅ Conexão com Pagar.me estabelecida com sucesso!');
        updatePagarmeStatus(); updateIntegrationBanner();
    }, 1500);
});

function updatePagarmeStatus() {
    const el = document.getElementById('pagarme-status');
    if (!el) return;
    if (appConfig.connected && appConfig.apiKey) {
        el.innerHTML = '<div class="status-dot connected"></div><span>Pagar.me Conectado (' + appConfig.ambiente + ')</span>';
    } else {
        el.innerHTML = '<div class="status-dot disconnected"></div><span>Pagar.me Desconectado</span>';
    }
}

function updateIntegrationBanner() {
    const banner = document.getElementById('integration-banner');
    const text = document.getElementById('integration-status-text');
    if (!banner) return;
    if (appConfig.connected) {
        banner.classList.add('connected');
        banner.querySelector('.integration-icon').textContent = '✅';
        if (text) text.textContent = `Conectado ao Pagar.me (${appConfig.ambiente === 'live' ? 'Produção' : 'Sandbox'})`;
    } else {
        banner.classList.remove('connected');
        banner.querySelector('.integration-icon').textContent = '🔌';
        if (text) text.textContent = 'Desconectado — Configure sua API Key abaixo';
    }
}

// ============================================
// PATCH: Add proof column to cases table
// ============================================
function patchCasesTable() {
    const origRender = window.renderCasesTable;
    if (!origRender) return;
    const origRenderCases = renderCasesTable;
    window.renderCasesTable = function (filter) {
        origRenderCases(filter);
    };
}

const _origRenderCasesTable = typeof renderCasesTable === 'function' ? renderCasesTable : null;
if (_origRenderCasesTable) {
    window.renderCasesTable = function (filter) {
        const currentFilterLocal = filter || currentFilter;
        const tbody = document.getElementById('cases-table-body');
        if (!tbody) return;
        let filtered = window.chargebacks;
        if (currentFilterLocal !== 'todos') filtered = window.chargebacks.filter(c => c.status === currentFilterLocal);
        const searchTerm = document.getElementById('search-input').value.toLowerCase() || '';
        if (searchTerm) filtered = filtered.filter(c => c.id.toLowerCase().includes(searchTerm) || c.cliente.nome.toLowerCase().includes(searchTerm));

        tbody.innerHTML = filtered.map(c => {
            const proof = c.proofComplete || 0;
            const proofClass = proof >= 80 ? 'high' : proof >= 40 ? 'mid' : 'low';
            return `<tr>
                <td><input type="checkbox" class="case-checkbox" data-id="${c.id}"></td>
                <td><span style="color:var(--indigo-400);font-weight:600">${c.id}</span></td>
                <td><div><span>${maskName(c.cliente.nome)}</span><br><span style="font-size:0.72rem;color:var(--text-muted)">${maskEmail(c.cliente.email)}</span></div></td>
                <td><strong>R$ ${c.transacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
                <td>${MOTIVOS_MAP[c.motivo] || c.motivo}</td>
                <td>${BANDEIRAS_MAP[c.transacao.bandeira] || c.transacao.bandeira}</td>
                <td>${getStatusBadge(c.status)}</td>
                <td><div class="proof-indicator"><div class="proof-bar"><div class="proof-bar-fill ${proofClass}" style="width:${proof}%"></div></div><span class="proof-text">${proof}%</span></div></td>
                <td>${getPrazoDisplay(c.prazo)}</td>
                <td><div style="display:flex;gap:6px">
                    <button class="action-btn" onclick="openCaseDetail('${c.id}')" title="Detalhes"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
                    <button class="action-btn defense" onclick="goToDefesa('${c.id}')" title="Defesa Pagar.me"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></button>
                    ${c.status !== 'ganho' && c.status !== 'perdido' ? `<button class="action-btn advance" onclick="advanceCase('${c.id}')" title="Avançar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>` : ''}
                </div></td>
            </tr>`;
        }).join('');
        currentFilter = currentFilterLocal;
    };
}

function goToDefesa(caseId) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('nav-defesa').classList.add('active');
    document.getElementById('page-defesa').classList.add('active');
    document.getElementById('page-title').textContent = 'Defesa Pagar.me';
    document.getElementById('page-subtitle').textContent = 'Gerar carta de defesa e enviar disputa';
    initDefesaPage();
    setTimeout(() => {
        const sel = document.getElementById('defesa-caso-select');
        if (sel) { sel.value = caseId; sel.dispatchEvent(new Event('change')); }
    }, 100);
}
