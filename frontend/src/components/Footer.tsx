import { MARCA } from '../lib/brand';

export function Footer() {
  return (
    <footer className="border-t border-slate-100 px-4 py-3 text-center text-[11px] text-slate-400">
      {MARCA.footer}
    </footer>
  );
}
