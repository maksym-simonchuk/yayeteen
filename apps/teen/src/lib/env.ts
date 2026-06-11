const BOM_RE = /^﻿/;

export function stripBom(s: string): string {
  return s.replace(BOM_RE, '').trim();
}
