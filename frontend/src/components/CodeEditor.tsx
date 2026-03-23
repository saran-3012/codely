import Editor from '@monaco-editor/react';
import { Language } from '../types';

interface Props {
  code: string;
  language: Language;
  onChange: (value: string) => void;
}

const CodeEditor = ({ code, language, onChange }: Props) => (
  <Editor
    height="100%"
    language={language.monacoLanguage}
    value={code}
    theme="vs-dark"
    onChange={(value) => onChange(value ?? '')}
    options={{
      fontSize: 14,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderLineHighlight: 'all',
    }}
  />
);

export default CodeEditor;
