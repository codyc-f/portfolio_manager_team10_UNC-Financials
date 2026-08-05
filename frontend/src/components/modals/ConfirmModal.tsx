import { LoaderCircle, Trash2 } from "lucide-react";
import { FormError } from "../common/FormError";

interface ConfirmModalProps {
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  submitting: boolean;
  error: string;
  cancel: () => void;
  confirm: () => void;
}

export function ConfirmModal({ title, description, cancelLabel, confirmLabel, submitting, error, cancel, confirm }: ConfirmModalProps) {
  return <div className="modal-backdrop"><section className="confirm-modal" role="alertdialog" aria-modal="true"><div className="delete-icon"><Trash2 size={22} /></div><h2>{title}</h2><p>{description}</p>{error && <FormError message={error} />}<div><button className="secondary-button" onClick={cancel} disabled={submitting}>{cancelLabel}</button><button className="danger-button" onClick={confirm} disabled={submitting}>{submitting && <LoaderCircle className="spin" size={14} />}{confirmLabel}</button></div></section></div>;
}
