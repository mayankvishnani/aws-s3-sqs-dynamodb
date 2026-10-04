import type { QuoteStatus } from "../../types/quote";
import { Icon } from "./Icon";
import "./StatusBadge.css";

export function StatusBadge({ status }: { status: QuoteStatus }) {
  const icon = status === "COMPLETED" ? "check" : status === "FAILED" ? "close" : "clock";
  return (
    <span className={`status-badge status-${status.toLowerCase()}`}>
      <Icon name={icon} size={13} />
      {status.toLowerCase()}
    </span>
  );
}
