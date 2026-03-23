import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiCall } from '../hooks/useApiCall';
import CodeEditor from '../components/CodeEditor';
import LanguageSelector from '../components/LanguageSelector';
import OutputPanel from '../components/OutputPanel';
import RunButton from '../components/RunButton';
import api from '../api';
import { Language, ExecuteResponse } from '../types';

const LANGUAGES: Language[] = [
  {
    name: 'Python',
    pistonName: 'python',
    monacoLanguage: 'python',
    version: '*',
    defaultCode: 'print("Hello, World!")\n',
  },
  {
    name: 'JavaScript',
    pistonName: 'javascript',
    monacoLanguage: 'javascript',
    version: '*',
    defaultCode: 'console.log("Hello, World!");\n',
  },
  {
    name: 'TypeScript',
    pistonName: 'typescript',
    monacoLanguage: 'typescript',
    version: '*',
    defaultCode: 'const msg: string = "Hello, World!";\nconsole.log(msg);\n',
  },
  {
    name: 'C++',
    pistonName: 'c++',
    monacoLanguage: 'cpp',
    version: '*',
    defaultCode:
      '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello, World!" << endl;\n  return 0;\n}\n',
  },
  {
    name: 'C',
    pistonName: 'c',
    monacoLanguage: 'c',
    version: '*',
    defaultCode:
      '#include <stdio.h>\n\nint main() {\n  printf("Hello, World!\\n");\n  return 0;\n}\n',
  },
  {
    name: 'Java',
    pistonName: 'java',
    monacoLanguage: 'java',
    version: '*',
    defaultCode:
      'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}\n',
  },
  {
    name: 'Go',
    pistonName: 'go',
    monacoLanguage: 'go',
    version: '*',
    defaultCode:
      'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, World!")\n}\n',
  },
  {
    name: 'Rust',
    pistonName: 'rust',
    monacoLanguage: 'rust',
    version: '*',
    defaultCode: 'fn main() {\n  println!("Hello, World!");\n}\n',
  },
];

const EditorPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [selectedLang, setSelectedLang] = useState<Language>(LANGUAGES[0]);
  const [code, setCode] = useState(LANGUAGES[0].defaultCode);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [exitCode, setExitCode] = useState<number | null>(null);

  const { execute: runCode, loading: running } = useApiCall(async () => {
    const { data } = await api.post<ExecuteResponse>('/execute', {
      language: selectedLang.pistonName,
      version: selectedLang.version,
      code,
    });
    setOutput(data.run.stdout);
    setError(data.run.stderr);
    setExitCode(data.run.code);
  });

  const handleLangChange = (lang: Language) => {
    setSelectedLang(lang);
    setCode(lang.defaultCode);
    setOutput('');
    setError('');
    setExitCode(null);
  };

  const handleRun = async () => {
    setOutput('');
    setError('');
    setExitCode(null);
    await runCode();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-white font-bold text-lg">Codely</h1>
          <LanguageSelector
            languages={LANGUAGES}
            selected={selectedLang}
            onChange={handleLangChange}
          />
        </div>
        <div className="flex items-center gap-4">
          <RunButton onClick={handleRun} loading={running} />
          <span className="text-gray-400 text-sm hidden sm:block">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Code editor */}
        <div className="flex-1 overflow-hidden border-r border-gray-700">
          <CodeEditor code={code} language={selectedLang} onChange={setCode} />
        </div>

        {/* Output panel */}
        <div className="w-96 flex flex-col bg-gray-900">
          <div className="bg-gray-800 border-b border-gray-700 px-4 py-2 shrink-0">
            <span className="text-gray-300 text-sm font-medium">Output</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <OutputPanel
              output={output}
              error={error}
              exitCode={exitCode}
              loading={running}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
