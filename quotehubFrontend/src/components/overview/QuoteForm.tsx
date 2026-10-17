import { useRef, useState, type FormEvent } from "react";
import type { QuoteInput } from "../../types/quote";
import { Icon } from "../ui/Icon";
import "./QuoteForm.css";

const industries = ["Agriculture", "Construction", "Consulting", "Education", "Food & beverage", "Healthcare", "Manufacturing", "Professional services", "Retail", "Technology", "Transportation", "Other"];

export function QuoteForm({
  loading,
  onSubmit,
  initialInput,
  onCancel,
}: {
  loading: boolean;
  onSubmit: (input: QuoteInput, file?: File) => Promise<boolean>;
  initialInput?: QuoteInput;
  onCancel?: () => void;
}) {
  const editing = Boolean(initialInput);
  const [businessName, setBusinessName] = useState(initialInput?.businessName ?? "");
  const [industry, setIndustry] = useState(initialInput?.industry ?? "");
  const [annualRevenue, setAnnualRevenue] = useState(initialInput ? String(initialInput.annualRevenue) : "");
  const [state, setState] = useState(initialInput?.state ?? "");
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitted = await onSubmit({
      businessName: businessName.trim(),
      industry: industry.trim(),
      annualRevenue: Number(annualRevenue),
      state: state.trim().toUpperCase(),
    }, file ?? undefined);
    if (!submitted) return;
    if (editing) {
      onCancel?.();
      return;
    }
    setBusinessName("");
    setIndustry("");
    setAnnualRevenue("");
    setState("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectFile = (selected?: File) => {
    setFile(selected ?? null);
  };

  return (
    <div className="panel quote-panel" id="quote-form">
      <div className="panel-heading">
        <div><span className="section-kicker">{editing ? "UPDATE REQUEST" : "LET’S GET STARTED"}</span><h2>{editing ? "Edit quote details" : "Tell us about your business"}</h2><p>{editing ? "Saving will request fresh carrier options using these details." : "A few details help us find the right fit."}</p></div>
        {!editing && <span className="step-pill">STEP <b>01</b> / 01</span>}
      </div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="field field-wide">
            <span>Business name <i>*</i></span>
            <div className="input-wrap"><Icon name="briefcase" size={16} /><input required minLength={1} maxLength={120} value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="e.g. Northstar Coffee Co." /></div>
          </label>
          <label className="field">
            <span>Industry <i>*</i></span>
            <select required value={industry} onChange={(event) => setIndustry(event.target.value)}>
              <option value="" disabled>Select your industry</option>
              {initialInput && !industries.some((item) => item.toLowerCase() === initialInput.industry) && <option value={initialInput.industry}>{initialInput.industry}</option>}
              {industries.map((item) => <option key={item} value={item.toLowerCase()}>{item}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Annual revenue <i>*</i></span>
            <div className="input-wrap"><span className="input-prefix">$</span><input required type="number" min="1" step="any" value={annualRevenue} onChange={(event) => setAnnualRevenue(event.target.value)} placeholder="500,000" /></div>
          </label>
          <label className="field field-short">
            <span>State <i>*</i></span>
            <input required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" value={state} onChange={(event) => setState(event.target.value.toUpperCase())} placeholder="NY" />
          </label>
          {!editing && <div className="field field-wide">
            <span>Supporting document <small className="optional">OPTIONAL</small></span>
            <button
              type="button"
              className={`file-drop ${file ? "has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); }}
            >
              <span className="file-icon"><Icon name={file ? "check" : "upload"} size={17} /></span>
              <span className="file-copy"><b>{file ? file.name : "Click to upload or drag and drop"}</b><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Attached to your request` : "Any file type · Uploaded securely to your private request"}</small></span>
              {file && <span className="remove-file" onClick={(event) => { event.stopPropagation(); selectFile(); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="Remove file"><Icon name="close" size={15} /></span>}
            </button>
            <input ref={fileInputRef} className="visually-hidden" type="file" onChange={(event) => selectFile(event.target.files?.[0])} />
          </div>}
        </div>
        <div className="form-footer">
          <span className="privacy-note"><Icon name="shield" size={14} /> {editing ? "Your attached document will be kept." : "Your information stays private and secure."}</span>
          <div className="form-actions">
            {onCancel && <button className="button-secondary" type="button" onClick={onCancel} disabled={loading}>Cancel</button>}
            <button className="button-primary submit-button" type="submit" disabled={loading}>
              {loading ? <><span className="spinner" /> {editing ? "Saving changes" : "Sending request"}</> : <>{editing ? "Save changes" : "Compare my options"} <Icon name="arrow" size={15} /></>}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
