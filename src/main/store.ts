import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, basename } from 'node:path';
export class JsonStore<T> {
  notice: string | null = null;
  constructor(readonly file: string, private empty: () => T, private valid: (value: unknown) => value is T) {}
  read(): T {
    if (!existsSync(this.file)) return this.empty();
    try { const value: unknown = JSON.parse(readFileSync(this.file, 'utf8').replace(/^\uFEFF/,'')); if (!this.valid(value)) throw new Error('Invalid data'); return value; }
    catch { const backup = this.file + '.corrupt-' + Date.now(); copyFileSync(this.file, backup); this.notice = basename(this.file)==='orders.json'?'The order history file could not be read. The original was preserved as a .corrupt backup.':'The settings file could not be read. The original was preserved as a .corrupt backup; configure local settings again.'; return this.empty(); }
  }
  write(value: T) {
    if (!this.valid(value)) throw new Error('Refusing to save invalid local data.');
    mkdirSync(dirname(this.file), {recursive:true});
    const temporary = this.file + '.tmp';
    writeFileSync(temporary, JSON.stringify(value,null,2), {encoding:'utf8', mode:0o600, flush:true});
    renameSync(temporary, this.file);
  }
}
