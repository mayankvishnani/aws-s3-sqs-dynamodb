import { Icon } from "../ui/Icon";
import "./Footer.css";

export function Footer() {
  return (
    <footer className="footer">
      <span>© {new Date().getFullYear()} QuoteHub</span>
      <span><Icon name="shield" size={13} /> Your business deserves good coverage.</span>
    </footer>
  );
}
