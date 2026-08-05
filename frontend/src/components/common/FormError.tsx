import { AlertCircle } from "lucide-react";

export function FormError({ message }: { message: string }) {
  return <div className="form-error"><AlertCircle size={16} /><span>{message}</span></div>;
}
