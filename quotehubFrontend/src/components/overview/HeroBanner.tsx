import { Icon } from "../ui/Icon";
import "./HeroBanner.css";

export function HeroBanner({ onStartQuote }: { onStartQuote: () => void }) {
  return (
    <section className="welcome-row">
      <div>
        <div className="eyebrow"><span className="eyebrow-line" /> BUSINESS COVERAGE, MADE CLEAR</div>
        <h1>Good coverage.<br /><span>Better peace of mind.</span></h1>
        <p className="welcome-copy">Tell us a little about your business. We’ll gather options from our carrier network so you can make a confident call.</p>
        <button className="button-primary welcome-cta" onClick={onStartQuote}>Get your quotes <Icon name="arrow" size={16} /></button>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <div className="hero-glow" />
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="hero-shield"><Icon name="shield" size={76} /></div>
        <span className="float-chip chip-top"><span className="chip-dot mint" /> Your business, protected</span>
        <span className="float-chip chip-bottom"><Icon name="spark" size={14} /> Coverage that fits</span>
        <span className="hero-star star-one">✳</span>
        <span className="hero-star star-two">✦</span>
      </div>
    </section>
  );
}
