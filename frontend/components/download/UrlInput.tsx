import ActionButton from "@/components/ui/ActionButton";

interface UrlInputProps {
  buttonLabel: string;
  loading: boolean;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export default function UrlInput({
  buttonLabel,
  loading,
  onChange,
  onSubmit,
  placeholder,
  value,
}: UrlInputProps) {
  return (
    <div className="row mb8">
      <input
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmit();
        }}
      />
      <ActionButton className="shrink" disabled={loading} variant="primary" onClick={onSubmit}>
        {loading ? <span className="spinner" /> : null}
        {buttonLabel}
      </ActionButton>
    </div>
  );
}
