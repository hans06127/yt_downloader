interface OutputDirInputProps {
  defaultDir: string;
  outputDir: string;
  onChange: (outputDir: string) => void;
}

export default function OutputDirInput({ defaultDir, onChange, outputDir }: OutputDirInputProps) {
  return (
    <>
      <input
        placeholder={defaultDir ? `${defaultDir}\\{影片標題}` : "留空 = 自動建立"}
        type="text"
        value={outputDir}
        onChange={(event) => onChange(event.target.value)}
      />
      <div className="dir-hint">留空時將在系統下載資料夾內自動命名子資料夾</div>
    </>
  );
}
