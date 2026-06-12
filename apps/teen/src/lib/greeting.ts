/** Перше привітання чату. Деривується з імені онбордингу (null → анонімне). */
export function greetingFor(name: string | null): string {
  return name ? `розкажи, як ти зараз, ${name}?` : 'розкажи, як ти зараз?';
}
