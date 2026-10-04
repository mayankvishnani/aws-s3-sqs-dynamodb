import { Icon } from "../ui/Icon";

export function CoverageGuide() {
  return (
    <aside className="side-column">
      <div className="panel how-panel">
        <div className="mini-panel-title"><span className="section-kicker">SIMPLE BY DESIGN</span><span className="mini-title-icon"><Icon name="spark" size={15} /></span></div>
        <h3>Good decisions,<br />without the guesswork.</h3>
        <div className="process-step"><span className="process-number">01</span><span><b>Share the basics</b><small>Tell us about your business.</small></span></div>
        <div className="process-line" />
        <div className="process-step"><span className="process-number">02</span><span><b>We do the legwork</b><small>Carriers prepare your options.</small></span></div>
        <div className="process-line" />
        <div className="process-step"><span className="process-number">03</span><span><b>Choose with confidence</b><small>Compare coverage side by side.</small></span></div>
      </div>
      <div className="trust-card">
        <span className="trust-icon"><Icon name="shield" size={20} /></span>
        <div><b>Built around your business</b><p>Your details help carriers understand what makes your work unique.</p></div>
        <span className="trust-watermark"><Icon name="shield" size={85} /></span>
      </div>
    </aside>
  );
}
