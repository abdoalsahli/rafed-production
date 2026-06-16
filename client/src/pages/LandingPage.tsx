import { useState } from 'react';

const C = {
  bg:       '#F6F8FD',
  bg2:      '#EEF2FB',
  surface:  '#FFFFFF',
  surface2: '#F4F7FD',
  line:     'rgba(0,35,111,0.10)',
  line2:    'rgba(0,35,111,0.18)',
  ink:      '#0A1F4D',
  muted:    '#586A8C',
  muted2:   '#8A95B2',
  accent:   '#0FB5AC',
  accentD:  '#0A8C85',
  accentS:  'rgba(15,181,172,0.12)',
  brand:    '#00236F',
  brandD:   '#001A52',
};

const S = {
  section: { maxWidth: 1240, margin: '0 auto', padding: '90px 40px' } as React.CSSProperties,
  eyebrow: { fontSize: 14, fontWeight: 700, color: C.accent, letterSpacing: '.5px', marginBottom: 16 } as React.CSSProperties,
  h2: { fontSize: 'clamp(32px,4vw,50px)', lineHeight: 1.18, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 20px' } as React.CSSProperties,
  lead: { fontSize: 19, lineHeight: 1.8, color: C.muted, margin: 0 } as React.CSSProperties,
};

const STAGES = [
  { num: '01', title: 'رفع البطاقات',       caption: 'إدخال آمن',     body: 'يرفع المزوّد دفعة البطاقات إلى رافد عبر واجهة بسيطة — دون أي تعقيد تقني. تبدأ عملية الفحص فور الرفع.' },
  { num: '02', title: 'توليد البصمة',       caption: 'بصمة مشفّرة',   body: 'ينشئ النظام بصمة رقمية فريدة لكل بطاقة، لا يمكن منها استرجاع البيانات الحسّاسة — لكنها كافية للتعرّف على البطاقة بدقّة مطلقة.' },
  { num: '03', title: 'التحقق التاريخي',    caption: 'مقارنة شاملة',  body: 'تُقارَن كل بصمة بقاعدة بيانات تاريخية تضمّ كل بطاقة عرفتها المنصّة سابقاً عبر كامل الشبكة، لا داخل دفعتك فقط.' },
  { num: '04', title: 'كشف التكرار',        caption: 'رفض فوري',      body: 'إذا تطابقت بطاقة مع سجلّ سابق، تُعلَّم فوراً كمكرّرة وتُرفض قبل أن تدخل مخزونك أو تصل إلى أي موزّع.' },
  { num: '05', title: 'قبول آمن للمخزون',   caption: 'مخزون موثوق',   body: 'البطاقات النظيفة فقط تُقبل وتدخل شبكة التوزيع — مخزون موثوق، بلا ازدواجية، وبلا خسائر خفية.' },
];

function StageVisual({ i }: { i: number }) {
  const base: React.CSSProperties = { width: '100%', maxWidth: 300, aspectRatio: '1', background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 20, display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' };
  const inner: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 };

  if (i === 0) return (
    <div style={base}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%,rgba(15,181,172,0.12),transparent 60%)' }} />
      <div style={inner}>
        <div style={{ display: 'flex', gap: 7 }}>
          {[0,1,2].map(k => <div key={k} style={{ width: 34, height: 48, borderRadius: 7, background: 'linear-gradient(160deg,#DDEEF0,#EEF2FB)', border: `1px solid ${C.line2}` }} />)}
        </div>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 700 }}>دفعة بطاقات</div>
      </div>
    </div>
  );
  if (i === 1) return (
    <div style={base}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%,rgba(15,181,172,0.12),transparent 60%)' }} />
      <div style={inner}>
        <div style={{ fontFamily: 'monospace', fontSize: 14, letterSpacing: 2, color: C.accent, direction: 'ltr', background: '#EEF2FB', border: `1px solid ${C.line}`, borderRadius: 9, padding: '12px 16px' }}>7f·a2·e9·c4</div>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>بصمة فريدة</div>
      </div>
    </div>
  );
  if (i === 2) return (
    <div style={base}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%,rgba(15,181,172,0.12),transparent 60%)' }} />
      <div style={inner}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 120 }}>
          {[0.9, 0.6, 0.75, 0.45].map((w, k) => <div key={k} style={{ height: 8, borderRadius: 4, background: k === 1 ? C.accent : 'rgba(10,31,77,0.11)', width: `${w*100}%` }} />)}
        </div>
        <div style={{ fontSize: 13, color: C.muted, fontWeight: 700 }}>مطابقة السجلّات</div>
      </div>
    </div>
  );
  if (i === 3) return (
    <div style={base}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%,rgba(15,181,172,0.12),transparent 60%)' }} />
      <div style={inner}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', border: `2.5px solid ${C.accent}`, display: 'grid', placeItems: 'center', color: C.accent, fontSize: 30, fontWeight: 900 }}>!</div>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 800 }}>تكرار مرفوض</div>
      </div>
    </div>
  );
  return (
    <div style={base}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%,rgba(15,181,172,0.12),transparent 60%)' }} />
      <div style={inner}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: C.accent, display: 'grid', placeItems: 'center', color: '#fff', fontSize: 30, fontWeight: 900 }}>✓</div>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 800 }}>مخزون مقبول</div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [activeStage, setActiveStage] = useState(0);
  const stage = STAGES[activeStage];

  return (
    <div dir="rtl" lang="ar" style={{ background: C.bg, color: C.ink, fontFamily: "'Tajawal',system-ui,sans-serif", minHeight: '100vh', overflowX: 'hidden', WebkitFontSmoothing: 'antialiased' }}>
      <style>{`
        @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes glow{0%,100%{opacity:.5}50%{opacity:.9}}
        @keyframes growbar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
        .rf-nav-link:hover{color:${C.ink}!important}
        .rf-card-hover:hover{border-color:${C.line2}!important;transform:translateY(-4px)!important}
        .rf-btn-primary:hover{transform:translateY(-2px)!important}
        .rf-btn-outline:hover{border-color:${C.accent}!important;background:${C.accentS}!important}
        .rf-pipeline-node{cursor:pointer;transition:opacity .2s}
        .rf-pipeline-node:hover .rf-node-circle{border-color:${C.accent}!important}

        /* ── Responsive grid helpers ── */
        .rf-grid-hero{display:grid;grid-template-columns:1.05fr 0.95fr;gap:64px;align-items:center}
        .rf-grid-3col{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
        .rf-grid-3col-sm{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
        .rf-grid-2col{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center}
        .rf-grid-2col-cards{display:grid;grid-template-columns:1fr 1fr;gap:18px}
        .rf-grid-workflow{display:grid;grid-template-columns:0.82fr 1.18fr;gap:60px;align-items:start}
        .rf-grid-financial{display:grid;grid-template-columns:0.9fr 1.1fr;gap:64px;align-items:center}
        .rf-grid-revenue{display:grid;grid-template-columns:0.85fr 1.15fr;gap:56px;align-items:start}
        .rf-grid-5col{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}
        .rf-grid-pipeline{display:grid;grid-template-columns:repeat(5,1fr);gap:0;max-width:1000px;margin:0 auto 44px}
        .rf-pipeline-detail{display:grid;grid-template-columns:1fr 0.85fr;gap:44px;align-items:center}
        .rf-grid-4kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
        .rf-grid-dashboard-bottom{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;flex:1}
        .rf-grid-dashboard-outer{display:grid;grid-template-columns:200px 1fr;gap:14px;min-height:440px}
        .rf-grid-footer{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:48px}
        .rf-compare-table{background:${C.surface};border:1px solid ${C.line};border-radius:22px;overflow:hidden}
        .rf-compare-inner{min-width:0}
        .rf-section-inner{max-width:1240px;margin:0 auto;padding:90px 40px}
        .rf-hero-header{position:relative;max-width:1240px;margin:0 auto;padding:96px 40px 80px}
        .rf-hero-visual{position:relative;animation:floaty 8s ease-in-out infinite}
        .rf-distributor-diagram{position:relative;aspect-ratio:1.2;background:${C.surface};border:1px solid ${C.line};border-radius:24px;display:grid;place-items:center;overflow:hidden}

        @media(max-width:900px){
          .rf-grid-hero{grid-template-columns:1fr!important;gap:40px}
          .rf-hero-visual{display:none!important}
          .rf-hero-header{padding:60px 24px 48px!important}
          .rf-grid-3col{grid-template-columns:1fr!important}
          .rf-grid-3col-sm{grid-template-columns:1fr 1fr!important;gap:14px}
          .rf-grid-2col{grid-template-columns:1fr!important;gap:36px}
          .rf-grid-2col-cards{grid-template-columns:1fr!important}
          .rf-grid-workflow{grid-template-columns:1fr!important;gap:36px}
          .rf-grid-financial{grid-template-columns:1fr!important;gap:36px}
          .rf-grid-revenue{grid-template-columns:1fr!important;gap:36px}
          .rf-grid-5col{grid-template-columns:1fr 1fr!important}
          .rf-grid-pipeline{grid-template-columns:repeat(3,1fr)!important;max-width:100%!important}
          .rf-pipeline-detail{grid-template-columns:1fr!important}
          .rf-pipeline-visual{display:none!important}
          .rf-grid-4kpi{grid-template-columns:1fr 1fr!important}
          .rf-grid-dashboard-outer{grid-template-columns:1fr!important}
          .rf-grid-dashboard-bottom{grid-template-columns:1fr!important}
          .rf-sidebar-mock{display:none!important}
          .rf-grid-footer{grid-template-columns:1fr!important;gap:32px}
          .rf-section-inner{padding:60px 24px!important}
          .rf-compare-table{overflow-x:auto}
          .rf-compare-inner{min-width:480px}
          .rf-distributor-diagram{display:none!important}
          .rf-sticky-none{position:static!important}
          .rf-benefit-5col{grid-template-columns:1fr 1fr!important}
        }
        @media(max-width:600px){
          .rf-nav-links{display:none!important}
          .rf-grid-3col-sm{grid-template-columns:1fr!important}
          .rf-grid-5col{grid-template-columns:1fr!important}
          .rf-grid-4kpi{grid-template-columns:1fr 1fr!important}
          .rf-grid-pipeline{grid-template-columns:1fr 1fr!important}
          .rf-benefit-5col{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(18px)', background: 'rgba(246,248,253,0.82)', borderBottom: `1px solid ${C.line}` }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
          <a href="#top" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit', flexShrink: 0 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(140deg,${C.brand},${C.accent})`, display: 'inline-block', transform: 'rotate(45deg)', boxShadow: `0 0 24px rgba(15,181,172,0.4)` }} />
            <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}>رافد</span>
          </a>
          <div className="rf-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 34, fontSize: 16, fontWeight: 500, color: C.muted }}>
            {[['#platform','المنصة'],['#protection','الحماية من التكرار'],['#control','الشفافية المالية'],['#cta','تواصل معنا']].map(([h, l]) => (
              <a key={h} href={h} className="rf-nav-link" style={{ transition: 'color .2s', color: C.muted, textDecoration: 'none', whiteSpace: 'nowrap' }}>{l}</a>
            ))}
          </div>
          <a href="/login" className="rf-btn-primary" style={{ background: C.brand, color: '#fff', fontWeight: 800, fontSize: 15, padding: '12px 22px', borderRadius: 11, boxShadow: `0 8px 22px rgba(0,35,111,0.22)`, transition: 'transform .2s', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>سجل دخولك</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header id="top" className="rf-hero-header">
        <div style={{ position: 'absolute', top: -80, right: '8%', width: 520, height: 520, background: 'radial-gradient(circle,rgba(15,181,172,0.16),transparent 65%)', filter: 'blur(30px)', pointerEvents: 'none', animation: 'glow 7s ease-in-out infinite' }} />
        <div className="rf-grid-hero" style={{ position: 'relative' }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '8px 16px', border: `1px solid ${C.line2}`, borderRadius: 999, fontSize: 14, fontWeight: 600, color: C.muted, marginBottom: 28 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.accent, boxShadow: `0 0 10px ${C.accent}` }} />
              البنية التحتية لتوزيع البطاقات مسبقة الدفع
            </div>
            <h1 style={{ fontSize: 'clamp(36px,5.4vw,72px)', lineHeight: 1.08, fontWeight: 900, letterSpacing: '-1.5px', margin: '0 0 24px' }}>
              البنية التحتية التي تدير<br />شبكة توزيعك <span style={{ color: C.accent }}>بالكامل.</span>
            </h1>
            <p style={{ fontSize: 20, lineHeight: 1.85, color: C.muted, maxWidth: 540, margin: '0 0 36px', fontWeight: 400 }}>
              رافد يمنح مزوّدي بطاقات الاتصالات والقسائم والألعاب والهدايا سيطرة كاملة على المخزون والعمولات والأرصدة والمبيعات — مع حماية تاريخية تمنع تكرار البطاقات قبل دخولها شبكتك.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 34 }}>
              <a href="/login" className="rf-btn-primary" style={{ background: C.brand, color: '#fff', fontWeight: 800, fontSize: 17, padding: '17px 30px', borderRadius: 13, boxShadow: `0 12px 30px rgba(0,35,111,0.24)`, transition: 'transform .2s', textDecoration: 'none' }}>سجل دخولك</a>
              <a href="#protection" className="rf-btn-outline" style={{ background: 'transparent', color: C.ink, fontWeight: 700, fontSize: 17, padding: '17px 30px', borderRadius: 13, border: `1px solid ${C.line2}`, transition: 'border-color .2s,background .2s', textDecoration: 'none' }}>شاهد كيف يعمل</a>
            </div>
          </div>
          {/* Abstract dashboard */}
          <div className="rf-hero-visual">
            <div style={{ background: `linear-gradient(160deg,${C.surface2},${C.surface})`, border: `1px solid ${C.line2}`, borderRadius: 22, padding: 22, boxShadow: '0 40px 90px -30px rgba(10,31,77,0.16)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>أداء التوزيع</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, background: C.accentS, padding: '4px 10px', borderRadius: 7 }}>مباشر</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[['المبيعات','352,450','92%'],['المخزون','150,000','92%'],['مكرّر','0','18%']].map(([label, val, w], k) => (
                  <div key={k} style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 13, padding: 13 }}>
                    <div style={{ fontSize: 11, color: C.muted2, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: k === 2 ? C.accent : C.ink }}>{val}</div>
                    <div style={{ height: 3, borderRadius: 3, marginTop: 9, background: k === 2 ? C.accent : `linear-gradient(90deg,${C.accent},transparent)`, width: w }} />
                  </div>
                ))}
              </div>
              <div style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16, display: 'flex', alignItems: 'flex-end', gap: 8, height: 130, marginBottom: 16 }}>
                {[42,62,50,78,66,90,72].map((h, k) => (
                  <div key={k} style={{ flex: 1, height: `${h}%`, background: k === 3 || k === 5 ? `linear-gradient(180deg,${C.accent},${C.accentD})` : 'rgba(10,31,77,0.11)', borderRadius: '5px 5px 0 0', transformOrigin: 'bottom', animation: `growbar ${0.8+k*0.1}s ease both` }} />
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 74, height: 74, borderRadius: '50%', background: `conic-gradient(${C.accent} 0 72%,rgba(10,31,77,0.09) 72% 100%)`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 50, height: 50, borderRadius: '50%', background: C.surface, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800 }}>72%</div>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {[[C.accent,'100%'],[`rgba(10,31,77,0.28)`,'70%'],[`rgba(10,31,77,0.20)`,'48%']].map(([bg, w], k) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: bg }} />
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(10,31,77,0.09)', width: w }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── HIDDEN COST ── */}
      <section style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="rf-section-inner">
          <div style={{ maxWidth: 760, marginBottom: 54 }}>
            <div style={S.eyebrow}>التكلفة الخفية</div>
            <h2 style={S.h2}>التوزيع بالطرق التقليدية يُسرّب أرباحك بصمت.</h2>
            <p style={S.lead}>جداول البيانات والأنظمة المتفرّقة لم تُبنَ لإدارة شبكة توزيع تنمو. ومع كل دفعة بطاقات، تتراكم المخاطر — وغالباً لا تظهر إلا بعد أن تتحوّل إلى خسارة.</p>
          </div>
          <div className="rf-grid-3col">
            {[
              { shape: 'square', title: 'مخزون مكرّر يدخل الشبكة', body: 'بطاقة واحدة مكرّرة قد تُباع مرتين — خسارة مباشرة، عميل غاضب، وضرر يصعب إصلاحه في سمعتك.' },
              { shape: 'circle', title: 'رؤية غائبة عن الأداء', body: 'من دون لوحة موحّدة، تكتشف المشكلات بعد فوات الأوان — لا قبلها. القرارات تُبنى على تخمين، لا على بيانات.' },
              { shape: 'diamond', title: 'تحكّم يدوي هشّ', body: 'الأرصدة وحدود الائتمان والعمولات تُدار يدوياً — أخطاء مكلفة تنتظر الحدوث مع كل عملية وكل موزّع جديد.' },
            ].map(({ shape, title, body }) => (
              <div key={title} className="rf-card-hover" style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: 30, transition: 'border-color .25s,transform .25s' }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: C.accentS, display: 'grid', placeItems: 'center', marginBottom: 22 }}>
                  <span style={{ width: 18, height: 18, border: `2.5px solid ${C.accent}`, borderRadius: shape === 'circle' ? '50%' : 5, display: 'block', transform: shape === 'diamond' ? 'rotate(45deg)' : undefined }} />
                </div>
                <h3 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 12px' }}>{title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.75, color: C.muted, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY METHODS FAIL ── */}
      <section style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="rf-section-inner">
          <div style={{ maxWidth: 760, marginBottom: 48 }}>
            <div style={S.eyebrow}>لماذا تفشل الطرق الحالية</div>
            <h2 style={S.h2}>الأدوات التي تستخدمها اليوم لم تُبنَ لهذا.</h2>
            <p style={S.lead}>جداول البيانات سريعة في البداية، والأنظمة المتفرّقة تبدو كافية — حتى تنمو الشبكة. عندها تتحوّل الثغرات إلى خسائر.</p>
          </div>
          <div className="rf-compare-table">
            <div className="rf-compare-inner">
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', borderBottom: `1px solid ${C.line}` }}>
                <div style={{ padding: '22px 26px', fontSize: 15, fontWeight: 700, color: C.muted2 }}>القدرة</div>
                <div style={{ padding: '22px 18px', textAlign: 'center', fontSize: 15, fontWeight: 700, color: C.muted }}>جداول البيانات</div>
                <div style={{ padding: '22px 18px', textAlign: 'center', fontSize: 15, fontWeight: 700, color: C.muted }}>أنظمة متفرّقة</div>
                <div style={{ padding: '22px 18px', textAlign: 'center', fontSize: 15, fontWeight: 800, color: C.accent, background: C.accentS }}>رافد</div>
              </div>
              {[
                ['منع تكرار البطاقات',       false, false],
                ['الرؤية اللحظية للمبيعات',   false, 'partial'],
                ['التحكم في الأرصدة والعمولات', 'partial', 'partial'],
                ['التوسّع بلا فوضى',          false, false],
                ['سجلّ تدقيق كامل',           false, 'partial'],
              ].map(([label, col1, col2], i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', borderBottom: i < 4 ? `1px solid ${C.line}` : undefined, alignItems: 'center' }}>
                  <div style={{ padding: '20px 26px', fontSize: 16, fontWeight: 600 }}>{label}</div>
                  {[col1, col2].map((val, j) => (
                    <div key={j} style={{ padding: '20px 18px', display: 'grid', placeItems: 'center' }}>
                      {val === 'partial'
                        ? <span style={{ width: 11, height: 11, borderRadius: '50%', border: `2px solid rgba(10,31,77,0.32)` }} />
                        : <span style={{ width: 22, height: 3, borderRadius: 2, background: 'rgba(10,31,77,0.20)' }} />}
                    </div>
                  ))}
                  <div style={{ padding: '20px 18px', display: 'grid', placeItems: 'center', background: C.accentS }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: C.accent, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 900 }}>✓</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PLATFORM ── */}
      <section id="platform" style={{ background: C.bg2, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div className="rf-section-inner">
          <div style={{ maxWidth: 760, marginBottom: 54 }}>
            <div style={S.eyebrow}>منصة واحدة</div>
            <h2 style={S.h2}>كل ما تحتاجه لإدارة التوزيع، في نظام واحد.</h2>
            <p style={S.lead}>من رفع المخزون إلى آخر عملية بيع — رافد يجمع شبكة توزيعك كاملةً تحت سيطرة واحدة، واضحة ومحكومة.</p>
          </div>
          <div className="rf-grid-3col-sm">
            {[
              ['رفع المخزون','رفع دفعات البطاقات بسهولة، مع فحص تلقائي قبل القبول.'],
              ['إدارة المنتجات','تنظيم الفئات والأسعار والفئات النقدية في كتالوج موحّد.'],
              ['شبكة الموزّعين','إضافة الموزّعين وإدارة مستوياتهم وصلاحياتهم بدقّة.'],
              ['العمولات والأرصدة','تعريف هياكل العمولات وتسويتها تلقائياً لكل مستوى.'],
              ['حدود الائتمان','منح حدود ائتمانية محكومة للموزّعين بأمان كامل.'],
              ['مراقبة المبيعات','تتبّع كل عملية لحظياً عبر الشبكة بالكامل في مكان واحد.'],
            ].map(([title, body]) => (
              <div key={title} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 14 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: C.accent }} />
                  <h3 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{title}</h3>
                </div>
                <p style={{ fontSize: 15.5, lineHeight: 1.7, color: C.muted, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NETWORK WORKFLOW ── */}
      <section style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="rf-section-inner">
          <div className="rf-grid-workflow">
            <div className="rf-sticky-none" style={{ position: 'sticky', top: 110 }}>
              <div style={S.eyebrow}>آلية العمل</div>
              <h2 style={S.h2}>كيف تعمل شبكة التوزيع؟</h2>
              <p style={{ fontSize: 18, lineHeight: 1.85, color: C.muted, margin: '0 0 26px' }}>
                من اللحظة التي ينضمّ فيها موزّع جديد حتى آخر عملية بيع، تدير رافد كل خطوة — الاعتماد، الأرصدة، حدود الائتمان، الشراء، التسليم، والإيراد — بينما تحتفظ أنت بالسيطرة المالية الكاملة على شبكتك مهما اتّسعت.
              </p>
              <div style={{ background: C.surface, border: `1px solid ${C.line2}`, borderRadius: 18, padding: '22px 24px' }}>
                <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.5 }}>«وسّع شبكة موزّعيك دون أن تفقد ديناراً من السيطرة.»</div>
              </div>
            </div>
            <div style={{ position: 'relative', paddingRight: 8 }}>
              <div style={{ position: 'absolute', top: 24, bottom: 24, right: 23, width: 2, background: `linear-gradient(180deg,${C.accent},rgba(15,181,172,0.15))` }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
                {[
                  ['01','المزوّد','أنت تملك المخزون والشبكة — نقطة انطلاق كل شيء.',true],
                  ['02','إنشاء المنتجات','تحدّد الفئات والفئات النقدية والأسعار في كتالوج موحّد.',false],
                  ['03','اعتماد الموزّعين','توافق على من ينضمّ لشبكتك وتحدّد صلاحياته.',false],
                  ['04','ضبط العمولات','تعرّف هيكل العمولة لكل موزّع أو مستوى في الشبكة.',false],
                  ['05','الموزّعون يموّلون حساباتهم','يشحنون أرصدتهم ضمن حدود ائتمانية تحدّدها أنت.',false],
                  ['06','شراء البطاقات','يشترون من مخزونك المعتمد مباشرةً برصيدهم.',false],
                  ['07','تسليم تلقائي للبطاقات','تُسلَّم البطاقات فور الشراء — بلا تدخّل يدوي.',false],
                  ['08','توليد الإيراد','كل عملية بيع تُترجَم إلى إيراد محسوب بدقّة.',false],
                  ['09','تحديث التقارير','تنعكس كل حركة لحظياً في لوحاتك وتقاريرك المالية.',true,'last'],
                ].map(([num, title, body, highlighted, last]) => (
                  <div key={num as string} style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                    <div style={{
                      position: 'relative', zIndex: 2, width: 48, height: 48, flexShrink: 0, borderRadius: '50%',
                      background: highlighted === true && !last
                        ? `linear-gradient(140deg,${C.brand},${C.accent})`
                        : C.surface2,
                      border: last ? `2px solid ${C.accent}` : highlighted === true && !last ? 'none' : `1px solid ${C.line2}`,
                      color: highlighted === true && !last ? '#fff' : C.accent,
                      display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 900,
                      boxShadow: highlighted === true && !last ? `0 0 22px rgba(15,181,172,0.4)` : last ? `0 0 0 5px rgba(15,181,172,0.1)` : 'none',
                    }}>{num}</div>
                    <div style={{
                      flex: 1, background: last ? C.accentS : C.surface,
                      border: `1px solid ${last ? C.accent : C.line}`,
                      borderRadius: 14, padding: '16px 20px',
                    }}>
                      <div style={{ fontSize: 17, fontWeight: 800 }}>{title as string}</div>
                      <div style={{ fontSize: 14.5, color: C.muted, marginTop: 2 }}>{body as string}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Benefit cards */}
          <div className="rf-grid-5col rf-benefit-5col" style={{ marginTop: 54 }}>
            {[
              ['إدارة الموزّعين','اعتماد ومستويات وصلاحيات من نقطة واحدة.'],
              ['احتساب العمولات تلقائياً','تسوية دقيقة لكل مستوى بلا أخطاء يدوية.'],
              ['مراقبة الأرصدة والحدود الائتمانية','حدود محكومة وأرصدة محدّثة لحظياً.'],
              ['تتبّع المبيعات والإيرادات','رؤية كاملة لأداء الشبكة في كل لحظة.'],
              ['تقليل العمل التشغيلي','الأتمتة تتولّى المهام المتكرّرة بدلاً عن فريقك.'],
            ].map(([title, body]) => (
              <div key={title} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, padding: 24 }}>
                <div style={{ width: 40, height: 40, borderRadius: 11, background: C.accentS, display: 'grid', placeItems: 'center', marginBottom: 18 }}>
                  <span style={{ width: 14, height: 14, border: `2px solid ${C.accent}`, borderRadius: 4, display: 'block' }} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.4 }}>{title}</h3>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: C.muted, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DUPLICATE PROTECTION (INTERACTIVE) ── */}
      <section id="protection" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="rf-section-inner" style={{ paddingTop: 100, paddingBottom: 100 }}>
          <div style={{ position: 'absolute', top: 40, left: '6%', width: 480, height: 480, background: 'radial-gradient(circle,rgba(15,181,172,0.1),transparent 65%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ textAlign: 'center', maxWidth: 780, margin: '0 auto 60px', position: 'relative' }}>
            <div style={S.eyebrow}>الميزة الجوهرية</div>
            <h2 style={{ ...S.h2, fontSize: 'clamp(34px,4.4vw,56px)' }}>نمنع تكرار البطاقات قبل أن يكلّفك.</h2>
            <p style={{ fontSize: 20, lineHeight: 1.8, color: C.muted, margin: 0 }}>كل بطاقة تُرفع تُقارَن ببصمة تاريخية لكل بطاقة عرفها النظام من قبل عبر كامل الشبكة. التكرار يُكتشف ويُرفض — قبل أن يدخل مخزونك.</p>
          </div>
          {/* Pipeline nodes */}
          <div className="rf-grid-pipeline" style={{ position: 'relative' }}>
            {STAGES.map((s, i) => (
              <button key={i} onClick={() => setActiveStage(i)} className="rf-pipeline-node" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', cursor: 'pointer', position: 'relative', padding: '0 6px', background: 'none', border: 'none', fontFamily: 'inherit' }}>
                {i < 4 && <div style={{ position: 'absolute', top: 32, right: 0, left: '50%', height: 2, background: C.line }} />}
                {i > 0 && <div style={{ position: 'absolute', top: 32, right: '50%', left: 0, height: 2, background: C.line }} />}
                <div className="rf-node-circle" style={{ position: 'relative', width: 64, height: 64, borderRadius: '50%', background: activeStage === i ? C.accentS : C.surface, border: `${activeStage === i ? 2 : 1}px solid ${activeStage === i ? C.accent : C.line2}`, display: 'grid', placeItems: 'center', fontSize: 20, fontWeight: 900, zIndex: 2, transition: 'background .25s,border-color .25s', color: activeStage === i ? C.accent : C.muted }}>
                  {s.num}
                  {activeStage === i && <span style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${C.accent}`, boxShadow: `0 0 0 5px rgba(15,181,172,0.12)`, pointerEvents: 'none' }} />}
                </div>
                <div style={{ marginTop: 16, fontSize: 15, fontWeight: 700, color: activeStage === i ? C.ink : C.muted, transition: 'color .25s' }}>{s.title}</div>
              </button>
            ))}
          </div>
          {/* Detail panel */}
          <div style={{ maxWidth: 1000, margin: '0 auto', background: `linear-gradient(150deg,${C.surface2},${C.surface})`, border: `1px solid ${C.line2}`, borderRadius: 24, padding: 44, position: 'relative', overflow: 'hidden' }}>
            <div className="rf-pipeline-detail">
              <div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.accent, background: C.accentS, padding: '5px 13px', borderRadius: 8 }}>المرحلة {stage.num}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{stage.caption}</span>
                </div>
                <h3 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.6px', margin: '0 0 16px' }}>{stage.title}</h3>
                <p style={{ fontSize: 18, lineHeight: 1.85, color: C.muted, margin: 0 }}>{stage.body}</p>
              </div>
              <div className="rf-pipeline-visual" style={{ display: 'flex', justifyContent: 'center' }}>
                <StageVisual i={activeStage} />
              </div>
            </div>
          </div>
          <p style={{ textAlign: 'center', margin: '26px 0 0', fontSize: 14, color: C.muted2 }}>اضغط على أي مرحلة لاستعراض تفاصيلها.</p>
        </div>
      </section>

      {/* ── REVENUE GROWTH ── */}
      <section style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="rf-section-inner">
          <div className="rf-grid-revenue">
            <div className="rf-sticky-none" style={{ position: 'sticky', top: 110 }}>
              <div style={S.eyebrow}>فرص النمو</div>
              <h2 style={S.h2}>حوّل السيطرة إلى نمو.</h2>
              <p style={{ fontSize: 19, lineHeight: 1.8, color: C.muted, margin: '0 0 28px' }}>حين تختفي المخاطر والأخطاء، يتحرّر فريقك ليركّز على ما يهم فعلاً: توسيع الشبكة وزيادة الإيراد.</p>
              <div style={{ background: C.surface, border: `1px solid ${C.line2}`, borderRadius: 18, padding: 24 }}>
                <div style={{ fontSize: 46, fontWeight: 900, color: C.accent, letterSpacing: '-1px' }}>صفر</div>
                <div style={{ fontSize: 16, color: C.muted, lineHeight: 1.6, marginTop: 4 }}>بطاقة مكرّرة تدخل شبكتك — صفر تسريب، صفر مبيعات ضائعة.</div>
              </div>
            </div>
            <div className="rf-grid-2col-cards">
              {[
                ['شبكة أوسع، مخاطر أقل','أضِف موزّعين بثقة — فكل بطاقة محميّة قبل أن تصل إليهم.'],
                ['عمولات أذكى','هياكل عمولات مرنة تحفّز كل مستوى في الشبكة على البيع أكثر.'],
                ['قرارات أسرع','بيانات لحظية تكشف الأبطال والفرص فور حدوثها، لا بعد شهر.'],
                ['إيراد محفوظ بالكامل','كل بطاقة محميّة تعني كل دينار محفوظاً — لا خسائر صامتة تأكل هامشك.'],
              ].map(([title, body]) => (
                <div key={title} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 20, padding: 30 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: C.accentS, display: 'grid', placeItems: 'center', marginBottom: 20 }}>
                    <span style={{ width: 16, height: 16, border: `2.5px solid ${C.accent}`, borderRadius: '50%', display: 'block' }} />
                  </div>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 10px' }}>{title}</h3>
                  <p style={{ fontSize: 15.5, lineHeight: 1.7, color: C.muted, margin: 0 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINANCIAL TRANSPARENCY ── */}
      <section id="control" style={{ background: C.bg2, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
        <div className="rf-section-inner">
          <div className="rf-grid-financial">
            <div>
              <div style={S.eyebrow}>التحكّم والشفافية</div>
              <h2 style={S.h2}>شفافية مالية كاملة، لحظة بلحظة.</h2>
              <p style={{ fontSize: 19, lineHeight: 1.8, color: C.muted, margin: '0 0 30px' }}>تعرف أين يقف كل دينار في شبكتك — من المخزون إلى العمولة إلى الرصيد — دون انتظار تقرير نهاية الشهر.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {[
                  ['تتبّع كل دينار','حركة الأرصدة والمبيعات والمستحقات في عرض واحد محدّث.'],
                  ['تسوية تلقائية للعمولات','احتساب مستحقات كل مستوى في الشبكة بلا أخطاء يدوية.'],
                  ['تقارير جاهزة للإدارة','رؤى تنفيذية واضحة تدعم القرار دون فرق تقنية.'],
                ].map(([title, body]) => (
                  <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span style={{ width: 24, height: 24, borderRadius: 7, background: C.accentS, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2 }}>
                      <span style={{ width: 8, height: 8, background: C.accent, borderRadius: 2 }} />
                    </span>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 3 }}>{title}</div>
                      <div style={{ fontSize: 15.5, color: C.muted, lineHeight: 1.6 }}>{body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Abstract financial dashboard */}
            <div style={{ background: `linear-gradient(160deg,${C.surface2},${C.surface})`, border: `1px solid ${C.line2}`, borderRadius: 22, padding: 26, boxShadow: '0 40px 90px -40px rgba(10,31,77,0.16)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>نظرة مالية</span>
                <div style={{ display: 'flex', gap: 7 }}>
                  <span style={{ fontSize: 11, color: C.muted2, background: C.bg2, padding: '5px 11px', borderRadius: 7 }}>شهري</span>
                  <span style={{ fontSize: 11, color: C.accent, background: C.accentS, padding: '5px 11px', borderRadius: 7 }}>ربع سنوي</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                {[['إجمالي المبيعات','352,450','▲ 18%'],['العمولات المسوّاة','7,562.5','▲ 9%']].map(([label, val, change]) => (
                  <div key={label} style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 }}>
                    <div style={{ fontSize: 12, color: C.muted2, marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 26, fontWeight: 900 }}>{val}</div>
                    <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginTop: 6 }}>{change}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 96, gap: 9 }}>
                  {[38,54,46,68,58,80].map((h, k) => (
                    <div key={k} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 3 }}>
                      <div style={{ height: h, background: `linear-gradient(180deg,${C.accent},${C.accentD})`, borderRadius: 4 }} />
                      <div style={{ height: [20,24,30,18,34,14][k], background: 'rgba(10,31,77,0.09)', borderRadius: 4 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DASHBOARD VISIBILITY ── */}
      <section>
        <div className="rf-section-inner">
          <div style={{ textAlign: 'center', maxWidth: 740, margin: '0 auto 50px' }}>
            <div style={S.eyebrow}>الرؤية الكاملة</div>
            <h2 style={S.h2}>لوحة واحدة… شبكتك كاملةً أمامك.</h2>
            <p style={S.lead}>كل مخزون، كل موزّع، كل عملية — في مكان واحد، واضح، ومحدّث لحظياً.</p>
          </div>
          <div style={{ background: `linear-gradient(160deg,${C.surface2},${C.surface})`, border: `1px solid ${C.line2}`, borderRadius: 24, padding: 14, boxShadow: '0 50px 110px -40px rgba(10,31,77,0.18)' }}>
            <div className="rf-grid-dashboard-outer">
              {/* Sidebar */}
              <div className="rf-sidebar-mock" style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 4px 16px', borderBottom: `1px solid ${C.line}`, marginBottom: 8 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, background: `linear-gradient(140deg,${C.brand},${C.accent})`, transform: 'rotate(45deg)' }} />
                  <span style={{ fontSize: 16, fontWeight: 900 }}>رافد</span>
                </div>
                {[['لوحة التحكم',true],['المخزون',false],['الموزّعون',false],['العمولات',false],['التقارير',false]].map(([label, active]) => (
                  <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 10, background: active ? C.accentS : 'transparent' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: active ? C.accent : 'rgba(10,31,77,0.22)' }} />
                    <span style={{ fontSize: 14, fontWeight: active ? 700 : 400, color: active ? C.ink : C.muted }}>{label as string}</span>
                  </div>
                ))}
              </div>
              {/* Main area */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="rf-grid-4kpi">
                  {[['إجمالي المخزون','150,000',false],['مبيعات اليوم','4720',false],['موزّعون نشطون','15',false],['مكرّر','0',true]].map(([label, val, accent]) => (
                    <div key={label as string} style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 }}>
                      <div style={{ fontSize: 11, color: C.muted2, marginBottom: 7 }}>{label as string}</div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: accent ? C.accent : C.ink }}>{val as string}</div>
                    </div>
                  ))}
                </div>
                <div className="rf-grid-dashboard-bottom">
                  <div style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 18 }}>المبيعات عبر الأسبوع</div>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 10, minHeight: 140 }}>
                      {[45,60,52,74,64,88,70].map((h, k) => (
                        <div key={k} style={{ flex: 1, height: `${h}%`, background: k === 3 || k === 5 ? `linear-gradient(180deg,${C.accent},${C.accentD})` : 'rgba(10,31,77,0.11)', borderRadius: '5px 5px 0 0' }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ background: C.bg2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, marginBottom: 16 }}>أعلى الموزّعين</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                      {[['12,450',true],['8,320',false],['6,100',false],['4,780',false]].map(([val, first], k) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                          <span style={{ width: 30, height: 30, borderRadius: 9, background: first ? C.accentS : 'rgba(10,31,77,0.07)', flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 8, width: `${[80,65,55,48][k]}%`, borderRadius: 4, background: 'rgba(10,31,77,0.13)', marginBottom: 6 }} />
                            <div style={{ height: 6, width: `${[45,40,35,30][k]}%`, borderRadius: 3, background: 'rgba(10,31,77,0.06)' }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: first ? C.accent : C.ink }}>{val as string}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DISTRIBUTOR NETWORK ── */}
      <section style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="rf-section-inner">
          <div className="rf-grid-2col">
            <div>
              <div style={S.eyebrow}>شبكة التوزيع</div>
              <h2 style={S.h2}>وسّع شبكة موزّعيك دون أن تفقد السيطرة.</h2>
              <p style={{ fontSize: 19, lineHeight: 1.8, color: C.muted, margin: '0 0 32px' }}>أضِف موزّعين بأي عدد، عرّف مستوياتهم وحدودهم وعمولاتهم — وابقَ مسيطراً على كل طبقة في الشبكة من نقطة واحدة.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {[['∞','موزّعون بلا حدود'],['متعدّد','مستويات هرمية'],['لحظي','تحديث الأرصدة']].map(([val, label]) => (
                  <div key={label} style={{ background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: C.accent }}>{val}</div>
                    <div style={{ fontSize: 14, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Network diagram */}
            <div className="rf-distributor-diagram">
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%,rgba(15,181,172,0.1),transparent 62%)' }} />
              <svg viewBox="0 0 400 340" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
                <g stroke="rgba(15,181,172,0.35)" strokeWidth="1.5">
                  <line x1="200" y1="170" x2="90" y2="70" /><line x1="200" y1="170" x2="310" y2="70" />
                  <line x1="200" y1="170" x2="60" y2="220" /><line x1="200" y1="170" x2="340" y2="220" />
                  <line x1="200" y1="170" x2="140" y2="290" /><line x1="200" y1="170" x2="260" y2="290" />
                </g>
              </svg>
              <div style={{ position: 'relative', width: 78, height: 78, borderRadius: 18, background: `linear-gradient(140deg,${C.brand},${C.accent})`, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 900, color: '#fff', boxShadow: `0 0 36px rgba(15,181,172,0.5)`, zIndex: 2 }}>المزوّد</div>
              {[['11%','16%'],['11%','left:16%'],['56%','7%'],['56%','left:7%'],['bottom:7%','30%'],['bottom:7%','left:30%']].map((_, k) => (
                <div key={k} style={{ position: 'absolute', ...(['top:11%,right:16%','top:11%,left:16%','top:56%,right:7%','top:56%,left:7%','bottom:7%,right:30%','bottom:7%,left:30%'][k].split(',').reduce((a, p) => ({ ...a, [p.split(':')[0]]: p.split(':')[1] }), {})), width: 50, height: 50, borderRadius: '50%', background: C.bg2, border: `1px solid ${C.line2}` }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="cta" style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="rf-section-inner" style={{ paddingTop: 110, paddingBottom: 110, textAlign: 'center' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 640, height: 440, background: 'radial-gradient(circle,rgba(15,181,172,0.16),transparent 65%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontSize: 'clamp(34px,5vw,64px)', lineHeight: 1.1, fontWeight: 900, letterSpacing: '-1.4px', margin: '0 0 24px' }}>
              جاهز لتوزيع <span style={{ color: C.accent }}>تثق به؟</span>
            </h2>
            <p style={{ fontSize: 21, lineHeight: 1.7, color: C.muted, maxWidth: 620, margin: '0 auto 40px' }}>
              شاهد كيف يمنح رافد فريقك سيطرة كاملة على شبكة التوزيع — وحماية تاريخية لا توفّرها أي طريقة تقليدية.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/login" className="rf-btn-primary" style={{ background: C.brand, color: '#fff', fontWeight: 800, fontSize: 18, padding: '19px 36px', borderRadius: 14, boxShadow: `0 16px 38px rgba(0,35,111,0.26)`, transition: 'transform .2s', textDecoration: 'none' }}>سجل دخولك</a>
              <a href="tel:+218944513974" className="rf-btn-outline" style={{ background: 'transparent', color: C.ink, fontWeight: 700, fontSize: 18, padding: '19px 36px', borderRadius: 14, border: `1px solid ${C.line2}`, transition: 'border-color .2s', textDecoration: 'none' }}>تواصل مع فريق المبيعات</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${C.line}`, background: C.bg2 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: '60px 24px 48px' }}>
          <div className="rf-grid-footer">
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 18 }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(140deg,${C.brand},${C.accent})`, transform: 'rotate(45deg)', flexShrink: 0 }} />
                <span style={{ fontSize: 22, fontWeight: 900 }}>رافد</span>
              </div>
              <p style={{ fontSize: 14.5, color: C.muted, lineHeight: 1.8, margin: '0 0 24px' }}>منصة لإدارة توزيع البطاقات مسبقة الدفع — تمنح المزوّدين سيطرة كاملة على المخزون والموزّعين والعمولات.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.muted2 }}>للتواصل</span>
                <a href="tel:+218944513974" style={{ fontSize: 15, fontWeight: 700, color: C.ink, textDecoration: 'none', direction: 'ltr', display: 'inline-block' }}>+218-944513974</a>
              </div>
            </div>
            {/* Platform links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.muted2, marginBottom: 2, letterSpacing: '.4px' }}>المنصة</div>
              <a href="#platform" style={{ fontSize: 14.5, color: C.muted, textDecoration: 'none' }}>القدرات</a>
              <a href="#protection" style={{ fontSize: 14.5, color: C.muted, textDecoration: 'none' }}>الحماية من التكرار</a>
              <a href="#control" style={{ fontSize: 14.5, color: C.muted, textDecoration: 'none' }}>الشفافية المالية</a>
              <a href="#cta" style={{ fontSize: 14.5, color: C.muted, textDecoration: 'none' }}>تواصل معنا</a>
            </div>
            {/* Account */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.muted2, marginBottom: 2, letterSpacing: '.4px' }}>الحساب</div>
              <a href="/login" style={{ fontSize: 14.5, color: C.muted, textDecoration: 'none' }}>تسجيل الدخول</a>
              <a href="/signup" style={{ fontSize: 14.5, color: C.muted, textDecoration: 'none' }}>إنشاء حساب</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.line}`, padding: '18px 24px', maxWidth: 1240, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13, color: C.muted2 }}>
          <span>مستند لتقنية المعلومات</span>
          <span style={{ direction: 'ltr' }}>© 2026 Rafed</span>
        </div>
      </footer>
    </div>
  );
}
