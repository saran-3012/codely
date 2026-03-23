import { Language } from '../types';

interface Props {
  languages: Language[];
  selected: Language;
  onChange: (lang: Language) => void;
}

const LanguageSelector = ({ languages, selected, onChange }: Props) => (
  <select
    value={selected.pistonName}
    onChange={(e) => {
      const lang = languages.find((l) => l.pistonName === e.target.value);
      if (lang) onChange(lang);
    }}
    className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
  >
    {languages.map((lang) => (
      <option key={lang.pistonName} value={lang.pistonName}>
        {lang.name}
      </option>
    ))}
  </select>
);

export default LanguageSelector;
