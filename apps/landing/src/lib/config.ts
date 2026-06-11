// BOM-strip потрібен: деякі env-файли зберігаються з UTF-8 BOM.
export const APP_BASE =
  process.env.NEXT_PUBLIC_TEEN_APP_URL?.replace(/^﻿/, '').trim() ||
  'https://yayeproduct-teen.vercel.app';
