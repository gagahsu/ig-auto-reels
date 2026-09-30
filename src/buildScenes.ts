import { T } from './theme';
export type Briefing = any;
export type SceneKind = 'intro' | 'futures' | 'indices' | 'adr' | 'news' | 'groups' | 'levels' | 'outro';
export type Scene = { id: string; kind: SceneKind; narration: string; highlights: string[]; data?: any };

const num = (s: string) => parseFloat(String(s).replace(/[^\d.\-+]/g, ''));
const abs = (s: string) => String(s).replace(/^[+\-]/, '').trim();
const stripHtml = (s: string) => s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '');

export function parseGroups(note: string) {
  const text = stripHtml(note || '');
  const groups = [...text.matchAll(/^\s*\d\.\s*(.+?)：(.+)$/gm)].map((m) => ({
    name: m[1].trim(),
    stocks: [...m[2].matchAll(/([一-鿿A-Za-z]+)\((\d{4,6})\)/g)].slice(0, 3).map((s) => ({ name: s[1], code: s[2] })),
  }));
  const lv = text.split('【開盤觀測與關鍵點位】')[1] || '';
  const sup = lv.match(/支撐[^0-9，。；]{0,8}([\d,]{5,})(?:\s*[～~\-至到]\s*([\d,]+))?/);
  const res = lv.match(/(?:短壓|壓力|上檔|上方)[^0-9，。；]{0,8}([\d,]{5,})/);
  const spot = lv.match(/現貨.*?收在([\d,]+)點/);
  return {
    groups,
    levels: sup || res ? { supportLo: sup?.[1], supportHi: sup?.[2], resistance: res?.[1], spot: spot?.[1] } : null,
  };
}

export function titleLines(b: Briefing) {
  const [, m, d] = b.date.split('.');
  const ch = num(b.futures_change);
  return [`${+m}/${+d} 台股盤前速報`, `夜盤${ch >= 0 ? '+' : '-'}${Math.abs(ch)}點・${b.outlook.trim()}`];
}

export function buildScenes(b: Briefing): Scene[] {
  const [, m, d] = b.date.split('.');
  const ch = num(b.futures_change), pct = num(b.futures_change_pct);
  const upWord = ch >= 0 ? (pct >= 1 ? '大漲' : '上漲') : (pct <= -1 ? '大跌' : '下跌');
  const outlook = b.outlook.trim();
  const S: Scene[] = [];
  S.push({ id: 'intro', kind: 'intro', narration: `${+m}月${+d}號台股盤前速報！台指期夜盤${upWord}${Math.abs(ch)}點，今天${outlook}。`, highlights: [`${Math.abs(ch)}點`, outlook] });

  const idx = b.us_indices as { name: string; value: string }[];
  const ups = idx.filter((x) => num(x.value) >= 0), downs = idx.filter((x) => num(x.value) < 0);
  let t = '美股四大指數，';
  if (downs.length) t += `${downs.map((x) => x.name).join('、')}${downs.length === idx.length ? '全數' : ''}收黑` + (ups.length ? '，' : '。');
  if (ups.length) t += `${ups.map((x) => `${x.name}上漲${abs(x.value)}`).join('、')}。`;
  S.push({ id: 'indices', kind: 'indices', narration: t, highlights: ups.map((x) => x.name), data: idx });

  const adr = [...b.adr].sort((a: any, c: any) => num(c.value) - num(a.value));
  const prem = abs(b.premium.replace('溢價', '').trim());
  S.push({ id: 'adr', kind: 'adr', narration: `台股ADR方面，${adr.map((x: any) => `${x.name}${num(x.value) >= 0 ? '漲' : '跌'}${abs(x.value)}`).join('，')}，台積電ADR溢價來到${prem}。`, highlights: [adr[0].name, prem], data: { adr, premium: b.premium } });
  S.push({ id: 'futures', kind: 'futures', narration: `昨晚台指期夜盤收在${b.futures_close}點，${ch >= 0 ? '上漲' : '下跌'}${Math.abs(ch)}點，${ch >= 0 ? '漲' : '跌'}幅${abs(b.futures_change_pct)}。`, highlights: [b.futures_close], data: b });

  (b.news as any[]).slice(0, 3).forEach((n, i) => {
    const hl = n.headline.split(/\s+/);
    S.push({ id: `news${i}`, kind: 'news', narration: hl.join('，') + '。', highlights: [(n.headline.match(/[\d,.]+[%點K]?/) || [''])[0]].filter(Boolean), data: { ...n, lines: hl, i, total: Math.min(3, b.news.length) } });
  });

  const { groups, levels } = parseGroups(b.groups_note);
  if (groups.length) S.push({ id: 'groups', kind: 'groups', narration: `今天焦點族群：${groups.map((g) => g.name).join('、')}。`, highlights: [], data: groups });
  if (levels) S.push({ id: 'levels', kind: 'levels', narration: `下檔支撐看${levels.supportLo}${levels.supportHi ? `到${levels.supportHi}` : ''}點，上方壓力看${levels.resistance}點。`, highlights: [levels.supportLo, levels.resistance].filter(Boolean) as string[], data: { ...levels, close: b.futures_close } });
  S.push({ id: 'outro', kind: 'outro', narration: '以上資訊僅供參考，不構成投資建議。歡迎留言或私訊你的觀察標的，我們明天盤前見！', highlights: ['不構成投資建議'] });
  return S;
}

export const estimateSec = (s: string) => Math.max(2.4, s.replace(/[，。、！？：\s]/g, '').length / T.charsPerSec + 0.5);
