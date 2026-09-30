export const T = {
  W: 1080, H: 1920, FPS: 30,
  font: '"Noto Sans TC","Noto Sans CJK TC","PingFang TC","Microsoft JhengHei",sans-serif',
  up: '#E23B32',      // 台股：漲紅
  down: '#179C52',    // 跌綠
  tag: '#C8312B',
  yellow: '#FFD84A',
  cream: '#FBF5E6',   // 頭貼奶油底
  ink: '#1E1E22',
  sub: '#55565C',
  brand: '三分鐘聊投資',
  brandZh: '盤前聚焦',
  logo: 'logo.jpg',
  disclaimer: '所有資訊內容僅供參考之用途，不構成任何個人或機構之意見或判斷，亦不構成任何投資建議，本帳號亦不保證其各項資訊內容之完整性、即時性及精確性。',
  charsPerSec: 5.4,   // 無語音時估算時長用
};
export const signColor = (v: string) => (v.trim().startsWith('-') ? T.down : T.up);
