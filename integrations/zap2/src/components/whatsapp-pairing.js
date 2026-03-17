const formatTimestamp = (value) => {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const statusConfig = {
  idle:        { label: 'Inicializando',       dot: 'dot-idle' },
  connecting:  { label: 'Conectando...',        dot: 'dot-connecting' },
  qr_ready:    { label: 'Aguardando leitura',   dot: 'dot-qr' },
  reconnecting:{ label: 'Reconectando...',      dot: 'dot-connecting' },
  logged_out:  { label: 'Sessao encerrada',     dot: 'dot-idle' },
  error:       { label: 'Falha na conexao',     dot: 'dot-error' },
};

export function WhatsAppPairing({ snapshot }) {
  const cfg = statusConfig[snapshot.status] ?? { label: snapshot.status, dot: 'dot-idle' };
  const ts  = formatTimestamp(snapshot.updatedAt);

  return (
    <div className="pair-root">
      {/* Left panel — instructions */}
      <div className="pair-left">
        <div className="pair-logo">
          <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="8" fill="#25d366"/>
            <path d="M16 5C9.925 5 5 9.925 5 16c0 1.94.496 3.763 1.366 5.352L5 27l5.797-1.34A10.94 10.94 0 0016 27c6.075 0 11-4.925 11-11S22.075 5 16 5z" fill="white"/>
            <path d="M21.5 18.83c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.47-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.19-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z" fill="#25d366"/>
          </svg>
          <span>ProspectAI</span>
        </div>

        <h1 className="pair-title">Conectar WhatsApp</h1>
        <p className="pair-subtitle">
          Use o WhatsApp no celular para escanear o QR code e ativar as
          notificações e automações do ProspectAI.
        </p>

        <ol className="pair-steps">
          <li>
            <div className="step-num">1</div>
            <div className="step-text">
              Abra o <strong>WhatsApp</strong> no seu celular
            </div>
          </li>
          <li>
            <div className="step-num">2</div>
            <div className="step-text">
              Toque em <strong>Dispositivos conectados</strong>
            </div>
          </li>
          <li>
            <div className="step-num">3</div>
            <div className="step-text">
              Aponte a câmera para o <strong>QR code</strong> ao lado
            </div>
          </li>
        </ol>

        <div className="pair-badge">
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm-.75 11.5l-3-3 1.06-1.06 1.94 1.94 4.19-4.19 1.06 1.06-5.25 5.25z" fill="#25d366"/>
          </svg>
          <div>
            <strong>Sessao criptografada e persistente</strong>
            <p>O pareamento e salvo no servidor. Voce nao precisa repetir esse processo.</p>
          </div>
        </div>
      </div>

      {/* Right panel — QR */}
      <div className="pair-right">
        <div className="pair-qr-card">
          {snapshot.qrCodeDataUrl ? (
            <img
              className="pair-qr-img"
              src={snapshot.qrCodeDataUrl}
              alt="QR code do WhatsApp"
            />
          ) : (
            <div className="pair-qr-placeholder">
              <div className="pair-spinner" aria-hidden="true" />
              <p>{snapshot.detail || 'Gerando QR code...'}</p>
            </div>
          )}
        </div>

        <div className="pair-status">
          <span className={`pair-dot ${cfg.dot}`} />
          <span className="pair-status-label">{cfg.label}</span>
          {ts && <span className="pair-status-time">{ts}</span>}
        </div>
      </div>
    </div>
  );
}
