import { Icon } from "../ui/Icon";

export function EmptyQuoteList({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name="file" size={20} /></span>
      <h3>No quotes yet</h3>
      <p>Your quote requests will appear here after you submit your first one.</p>
      <button className="button-primary" onClick={onCreate}>Create a quote <Icon name="arrow" size={14} /></button>
    </div>
  );
}
