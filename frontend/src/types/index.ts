export interface User {
  id: string;
  email: string;
}

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

export interface ExecuteRequest {
  language: string;
  version: string;
  code: string;
}

export interface ExecuteResponse {
  run: {
    stdout: string;
    stderr: string;
    code: number;
    signal: string | null;
    output: string;
  };
  language: string;
  version: string;
}

export interface Language {
  name: string;
  pistonName: string;
  monacoLanguage: string;
  version: string;
  defaultCode: string;
}
