import { Icon } from "./Icon";
import "./AlertMessage.css";

export function AlertMessage({
  error,
  notice,
  onDismiss,
}: {
  error: string;
  notice: string;
  onDismiss: () => void;
}) {
  if (!error && !notice) return null;
  return (
    <div className={`alert ${error ? "alert-error" : "alert-success"}`} role={error ? "alert" : "status"}>
      <span>{error || notice}</span>
      <button aria-label="Dismiss message" onClick={onDismiss}><Icon name="close" size={16} /></button>
    </div>
  );
}
