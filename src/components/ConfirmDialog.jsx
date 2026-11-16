import { useId } from 'react';
import Modal from './Modal.jsx';

// Confirmação no estilo do app, no lugar do confirm() do navegador.
// Esc, clique fora e "Cancelar" fecham sem executar nada.
export default function ConfirmDialog({ title, message, confirmLabel = 'Apagar', onConfirm, onCancel, busy = false }) {
  const descId = useId();
  return (
    <Modal title={title} onClose={onCancel} className="confirm-modal" closeLabel="Cancelar">
      <p id={descId} className="confirm-text">{message}</p>
      <div className="actions">
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button type="button" className="btn danger-solid" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}
