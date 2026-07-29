import { useState, useEffect } from 'react';

const A   = '#0FB5AC';
const DK  = '#00236F';
const INK = '#0A1F4D';
const BG  = '#F6F8FD';
const BG2 = '#EEF2FB';
const MU  = '#586A8C';
const MU2 = '#8A95B2';
const LN  = 'rgba(0,35,111,0.10)';
const GLOW = 'rgba(15,181,172,0.20)';

function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="العودة إلى الأعلى"
      style={{
        position: 'fixed', bottom: 32, left: 32, zIndex: 100,
        width: 48, height: 48, borderRadius: '50%',
        background: DK, color: '#fff', border: 'none',
        display: 'grid', placeItems: 'center', cursor: 'pointer',
        boxShadow: '0 8px 24px rgba(0,35,111,0.28)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .25s,transform .25s',
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        fontSize: 20, lineHeight: 1,
      }}
    >↑</button>
  );
}

export default function LandingPage() {

  return (
    <div dir="rtl" lang="ar" style={{ background: BG, color: INK, fontFamily: "'Tajawal',system-ui,sans-serif", minHeight: '100vh', overflowX: 'hidden', WebkitFontSmoothing: 'antialiased' }}>
      <style>{`
        *{box-sizing:border-box;}
        ::selection{background:rgba(15,181,172,0.26);color:#fff;}
        a{text-decoration:none;color:inherit;}

        @keyframes rfdGlow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.9;transform:scale(1.05)}}
        @keyframes rfdFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes rfdRise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}

        .rfd-nav-link{transition:color .2s;color:${MU};}
        .rfd-nav-link:hover{color:${INK}!important;}

        .rfd-btn-primary{background:${DK};color:#fff;font-weight:800;font-family:'Tajawal',sans-serif;border-radius:13px;border:none;cursor:pointer;transition:transform .2s,box-shadow .2s;}
        .rfd-btn-primary:hover{transform:translateY(-2px);}

        .rfd-btn-outline{background:#fff;color:${INK};font-weight:700;font-family:'Tajawal',sans-serif;border-radius:13px;border:1px solid ${LN};cursor:pointer;transition:border-color .2s,transform .2s;}
        .rfd-btn-outline:hover{border-color:${A};transform:translateY(-2px);}

        .rfd-nav-cta{background:${DK};color:#fff;font-weight:800;font-size:15px;padding:12px 22px;border-radius:11px;box-shadow:0 8px 22px rgba(0,35,111,0.22);transition:transform .2s;display:inline-block;}
        .rfd-nav-cta:hover{transform:translateY(-2px);}

        .rfd-feature-card{background:#fff;border:1px solid ${LN};border-radius:18px;padding:30px;transition:transform .25s,border-color .25s;}
        .rfd-feature-card:hover{transform:translateY(-4px);border-color:rgba(0,35,111,0.18);}

        .rfd-cta-primary{background:${DK};color:#fff;font-weight:800;font-family:'Tajawal',sans-serif;border-radius:14px;border:none;cursor:pointer;transition:transform .2s;}
        .rfd-cta-primary:hover{transform:translateY(-3px);}

        .rfd-cta-outline{background:#fff;color:${INK};font-weight:700;font-family:'Tajawal',sans-serif;border-radius:14px;border:1px solid ${LN};cursor:pointer;transition:border-color .2s;}
        .rfd-cta-outline:hover{border-color:${A};}

        .rfd-footer-link{font-size:14.5px;color:${MU};transition:color .2s;display:block;}
        .rfd-footer-link:hover{color:${INK};}

        @media(max-width:900px){
          .rfd-hero-chips{display:none!important;}
          .rfd-features-grid{grid-template-columns:1fr 1fr!important;}
          .rfd-steps-grid{grid-template-columns:1fr 1fr!important;}
          .rfd-steps-line{display:none!important;}
          .rfd-dup-grid{grid-template-columns:1fr!important;}
          .rfd-footer-inner{flex-direction:column!important;gap:32px!important;}
        }
        @media(max-width:600px){
          .rfd-features-grid{grid-template-columns:1fr!important;}
          .rfd-steps-grid{grid-template-columns:1fr!important;}
          .rfd-hero-btns{flex-direction:column!important;align-items:center!important;}
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, backdropFilter: 'blur(18px)', background: 'rgba(246,248,253,0.82)', borderBottom: `1px solid ${LN}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '18px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(140deg,${DK},${A})`, display: 'inline-block', transform: 'rotate(45deg)', boxShadow: `0 0 22px rgba(15,181,172,0.40)` }} />
            <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}>رافد</span>
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: 34, fontSize: 16, fontWeight: 500 }}>
            <a href="#features" className="rfd-nav-link">المنصة</a>
            <a href="#distributors" className="rfd-nav-link">الموزّعون</a>
            <a href="#dup" className="rfd-nav-link">الحماية من التكرار</a>
            <a href="#cta" className="rfd-nav-link">تواصل معنا</a>
          </div>
          <a href="/login" className="rfd-nav-cta">سجّل دخولك</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <header style={{ position: 'relative', maxWidth: 1200, margin: '0 auto', padding: '90px 40px 0', textAlign: 'center' }}>
        {/* glow blob */}
        <div style={{ position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)', width: 680, height: 480, background: `radial-gradient(circle,${GLOW},transparent 66%)`, filter: 'blur(36px)', pointerEvents: 'none', animation: 'rfdGlow 8s ease-in-out infinite' }} />

        <div style={{ position: 'relative' }}>
          {/* pill badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '8px 16px', border: `1px solid rgba(0,35,111,0.18)`, borderRadius: 999, fontSize: 14, fontWeight: 600, color: MU2, marginBottom: 28 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: A, boxShadow: `0 0 10px ${A}` }} />
            البنية التحتية لتوزيع الكروت في ليبيا
          </div>

          <h1 style={{ fontSize: 'clamp(40px,5.6vw,72px)', lineHeight: 1.08, fontWeight: 900, letterSpacing: '-1.5px', margin: '0 auto 22px', maxWidth: 880 }}>
            توزيع كروتك بالكامل،<br />في لوحة <span style={{ color: A }}>واحدة.</span>
          </h1>

          <p style={{ fontSize: 20, lineHeight: 1.8, color: MU, maxWidth: 600, margin: '0 auto 34px', fontWeight: 400 }}>
            تابِع المبيعات والمخزون ونشاط الموزّعين لحظة بلحظة — وأدِر شبكتك كاملةً من مكان واحد واضح ومحكوم.
          </p>

          <div className="rfd-hero-btns" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
            <a href="#cta" className="rfd-btn-primary" style={{ fontSize: 17, padding: '17px 32px', boxShadow: '0 14px 32px rgba(0,35,111,0.24)' }}>اطلب عرضاً تقديمياً</a>
            <a href="#features" className="rfd-btn-outline" style={{ fontSize: 17, padding: '17px 32px' }}>شاهد المنصة</a>
          </div>
          <p style={{ fontSize: 14, color: MU2, fontWeight: 500, margin: '0 0 56px' }}></p>
        </div>

        {/* DASHBOARD SHOWCASE */}
        <div style={{ position: 'relative' }}>
          {/* floating chips */}
          <div className="rfd-hero-chips" style={{ position: 'absolute', zIndex: 3, top: 64, right: -14, background: '#fff', border: `1px solid ${LN}`, borderRadius: 16, padding: '14px 18px', boxShadow: '0 18px 40px -16px rgba(10,31,77,0.28)', textAlign: 'right', animation: 'rfdFloat 6s ease-in-out infinite' }}>
            <div style={{ fontSize: 12, color: MU2, marginBottom: 4 }}>البطاقات المباعة اليوم</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: INK }}>84 <span style={{ fontSize: 13, color: MU, fontWeight: 600 }}>بطاقة</span></div>
          </div>
          <div className="rfd-hero-chips" style={{ position: 'absolute', zIndex: 3, bottom: 120, left: -14, background: '#fff', border: `1px solid ${LN}`, borderRadius: 16, padding: '14px 18px', boxShadow: '0 18px 40px -16px rgba(10,31,77,0.28)', textAlign: 'right', animation: 'rfdFloat 6s ease-in-out 1.2s infinite' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: A, boxShadow: `0 0 8px ${A}` }} />
              <span style={{ fontSize: 12, color: MU2 }}>تحديث مباشر</span>
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: INK }}>2,140.00 <span style={{ fontSize: 13, color: MU, fontWeight: 600 }}>د.ل</span></div>
          </div>

          {/* browser window */}
          <div style={{ position: 'relative', zIndex: 2, background: '#fff', border: `1px solid rgba(0,35,111,0.12)`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 60px 120px -45px rgba(10,31,77,0.30),0 10px 30px -10px rgba(10,31,77,0.12)', maxWidth: 1080, margin: '0 auto' }}>
            {/* chrome bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 18px', borderBottom: `1px solid rgba(0,35,111,0.08)`, background: '#F4F7FD' }}>
              <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#E5697A' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#E9B44C' }} />
                <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#4CC38A' }} />
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid rgba(0,35,111,0.10)`, borderRadius: 9, padding: '6px 16px', fontSize: 12.5, color: MU2, direction: 'ltr', fontFamily: "'Tajawal',sans-serif" }}>
                  <span style={{ width: 11, height: 11, borderRadius: '50%', border: `1.5px solid ${A}`, display: 'inline-block' }} />
                  app.rafed.ly/dashboard
                </div>
              </div>
              <div style={{ width: 54, flexShrink: 0 }} />
            </div>
            {/* screenshot with bottom fade */}
            <div style={{ position: 'relative', lineHeight: 0 }}>
              <img src="/dashboard.png" alt="لوحة تحكم رافد" style={{ display: 'block', width: '100%', height: 'auto' }} draggable={false} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, background: 'linear-gradient(180deg,rgba(255,255,255,0),#ffffff)', pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        <div style={{ height: 90 }} />
      </header>
      {/* ── FEATURES ── */}
      <section id="features" style={{ borderTop: `1px solid ${LN}`, background: BG2 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 40px' }}>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 56px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: A, letterSpacing: '.5px', marginBottom: 14 }}>منصة واحدة</div>
            <h2 style={{ fontSize: 'clamp(30px,4vw,48px)', lineHeight: 1.18, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 18px' }}>كل ما تحتاجه لإدارة التوزيع، في نظام واحد.</h2>
            <p style={{ fontSize: 19, lineHeight: 1.8, color: MU, margin: 0 }}>من رفع المخزون إلى آخر عملية بيع — رافد يجمع شبكتك كاملةً تحت سيطرة واحدة واضحة ومحكومة.</p>
          </div>

          <div className="rfd-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {[
              { shape: 'square',  title: 'رفع المخزون',        body: 'رفع دفعات البطاقات بسهولة مع فحص تلقائي قبل القبول.' },
              { shape: 'circle',  title: 'إدارة المنتجات',     body: 'تنظيم الفئات والأسعار والفئات النقدية في كتالوج موحّد.' },
              { shape: 'diamond', title: 'شبكة الموزّعين',     body: 'إضافة الموزّعين وإدارة مستوياتهم وصلاحياتهم بدقّة.' },
              { shape: 'bars',    title: 'العمولات والأرصدة',  body: 'تعريف هياكل العمولات وتسويتها تلقائياً لكل مستوى.' },
              { shape: 'card',    title: 'حدود الائتمان',      body: 'منح حدود ائتمانية محكومة للموزّعين بأمان كامل.' },
              { shape: 'eye',     title: 'مراقبة المبيعات',    body: 'تتبّع كل عملية لحظياً عبر الشبكة بالكامل في مكان واحد.' },
            ].map(({ shape, title, body }) => (
              <div key={title} className="rfd-feature-card">
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(15,181,172,0.12)', display: 'grid', placeItems: 'center', marginBottom: 20 }}>
                  {shape === 'square'  && <span style={{ width: 17, height: 17, border: `2.5px solid ${A}`, borderRadius: 5 }} />}
                  {shape === 'circle'  && <span style={{ width: 17, height: 17, border: `2.5px solid ${A}`, borderRadius: '50%' }} />}
                  {shape === 'diamond' && <span style={{ width: 17, height: 17, border: `2.5px solid ${A}`, transform: 'rotate(45deg)', display: 'block' }} />}
                  {shape === 'bars'    && <span style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}><span style={{ width: 4, height: 10, background: A, borderRadius: 2 }} /><span style={{ width: 4, height: 16, background: A, borderRadius: 2 }} /><span style={{ width: 4, height: 13, background: A, borderRadius: 2 }} /></span>}
                  {shape === 'card'    && <span style={{ width: 17, height: 17, border: `2.5px solid ${A}`, borderRadius: '5px 5px 13px 13px', display: 'block' }} />}
                  {shape === 'eye'     && <span style={{ width: 17, height: 17, border: `2.5px solid ${A}`, borderRadius: '50% 50% 50% 2px', display: 'block' }} />}
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 10px' }}>{title}</h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.7, color: MU, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HIDDEN COST ── */}
      <section style={{ borderTop: `1px solid ${LN}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 40px' }}>
          <div style={{ maxWidth: 760, marginBottom: 54 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: A, letterSpacing: '.5px', marginBottom: 16 }}>التكلفة الخفية</div>
            <h2 style={{ fontSize: 'clamp(32px,4vw,50px)', lineHeight: 1.18, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 20px' }}>التوزيع بالطرق التقليدية يُسرّب أرباحك بصمت.</h2>
            <p style={{ fontSize: 19, lineHeight: 1.8, color: MU, margin: 0 }}>جداول البيانات والأنظمة المتفرّقة لم تُبنَ لإدارة شبكة توزيع تنمو. ومع كل دفعة بطاقات، تتراكم المخاطر — وغالباً لا تظهر إلا بعد أن تتحوّل إلى خسارة.</p>
          </div>
          <div className="rfd-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {[
              { shape: 'square',  title: 'مخزون مكرّر يدخل الشبكة', body: 'بطاقة واحدة مكرّرة قد تُباع مرتين — خسارة مباشرة، عميل غاضب، وضرر يصعب إصلاحه في سمعتك.' },
              { shape: 'circle',  title: 'رؤية غائبة عن الأداء',    body: 'من دون لوحة موحّدة، تكتشف المشكلات بعد فوات الأوان — لا قبلها. القرارات تُبنى على تخمين، لا على بيانات.' },
              { shape: 'diamond', title: 'تحكّم يدوي هشّ',           body: 'الأرصدة وحدود الائتمان والعمولات تُدار يدوياً — أخطاء مكلفة تنتظر الحدوث مع كل عملية وكل موزّع جديد.' },
            ].map(({ shape, title, body }) => (
              <div key={title} className="rfd-feature-card">
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'rgba(15,181,172,0.12)', display: 'grid', placeItems: 'center', marginBottom: 22 }}>
                  <span style={{ width: 18, height: 18, border: `2.5px solid ${A}`, borderRadius: shape === 'circle' ? '50%' : 5, display: 'block', transform: shape === 'diamond' ? 'rotate(45deg)' : undefined }} />
                </div>
                <h3 style={{ fontSize: 21, fontWeight: 800, margin: '0 0 12px' }}>{title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.75, color: MU, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY METHODS FAIL ── */}
      <section style={{ borderTop: `1px solid ${LN}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 40px' }}>
          <div style={{ maxWidth: 760, marginBottom: 48 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: A, letterSpacing: '.5px', marginBottom: 16 }}>لماذا تفشل الطرق الحالية</div>
            <h2 style={{ fontSize: 'clamp(32px,4vw,50px)', lineHeight: 1.18, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 20px' }}>الأدوات التي تستخدمها اليوم لم تُبنَ لهذا.</h2>
            <p style={{ fontSize: 19, lineHeight: 1.8, color: MU, margin: 0 }}>جداول البيانات سريعة في البداية، والأنظمة المتفرّقة تبدو كافية — حتى تنمو الشبكة. عندها تتحوّل الثغرات إلى خسائر.</p>
          </div>
          <div style={{ background: '#fff', border: `1px solid ${LN}`, borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', borderBottom: `1px solid ${LN}` }}>
              <div style={{ padding: '22px 26px', fontSize: 15, fontWeight: 700, color: MU2 }}>القدرة</div>
              <div style={{ padding: '22px 18px', textAlign: 'center', fontSize: 15, fontWeight: 700, color: MU }}>جداول البيانات</div>
              <div style={{ padding: '22px 18px', textAlign: 'center', fontSize: 15, fontWeight: 700, color: MU }}>أنظمة متفرّقة</div>
              <div style={{ padding: '22px 18px', textAlign: 'center', fontSize: 15, fontWeight: 800, color: A, background: 'rgba(15,181,172,0.10)' }}>رافد</div>
            </div>
            {[
              ['منع تكرار البطاقات',          false,     false    ],
              ['الرؤية اللحظية للمبيعات',      false,     'partial'],
              ['التحكم في الأرصدة والعمولات',  'partial', 'partial'],
              ['التوسّع بلا فوضى',             false,     false    ],
              ['سجلّ تدقيق كامل',              false,     'partial'],
            ].map(([label, col1, col2], i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', borderBottom: i < 4 ? `1px solid ${LN}` : undefined, alignItems: 'center' }}>
                <div style={{ padding: '20px 26px', fontSize: 16, fontWeight: 600 }}>{label}</div>
                {[col1, col2].map((val, j) => (
                  <div key={j} style={{ padding: '20px 18px', display: 'grid', placeItems: 'center' }}>
                    {val === 'partial'
                      ? <span style={{ width: 11, height: 11, borderRadius: '50%', border: `2px solid rgba(10,31,77,0.32)` }} />
                      : <span style={{ width: 22, height: 3, borderRadius: 2, background: 'rgba(10,31,77,0.20)' }} />}
                  </div>
                ))}
                <div style={{ padding: '20px 18px', display: 'grid', placeItems: 'center', background: 'rgba(15,181,172,0.10)' }}>
                  <span style={{ width: 24, height: 24, borderRadius: '50%', background: A, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 900 }}>✓</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DISTRIBUTOR NETWORK ── */}
      <section id="distributors" style={{ borderTop: `1px solid ${LN}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }} className="rfd-dup-grid">
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: A, letterSpacing: '.5px', marginBottom: 16 }}>شبكة التوزيع</div>
              <h2 style={{ fontSize: 'clamp(32px,4vw,50px)', lineHeight: 1.16, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 20px' }}>وسّع شبكة موزّعيك دون أن تفقد السيطرة.</h2>
              <p style={{ fontSize: 19, lineHeight: 1.8, color: MU, margin: '0 0 32px' }}>أضِف موزّعين بأي عدد، عرّف مستوياتهم وحدودهم وعمولاتهم — وابقَ مسيطراً على كل طبقة في الشبكة من نقطة واحدة.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {[['∞','موزّعون بلا حدود'],['متعدّد','مستويات هرمية'],['لحظي','تحديث الأرصدة']].map(([val, label]) => (
                  <div key={label} style={{ background: '#fff', border: `1px solid ${LN}`, borderRadius: 16, padding: 20 }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: A }}>{val}</div>
                    <div style={{ fontSize: 14, color: MU, marginTop: 6, lineHeight: 1.5 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Network diagram */}
            <div style={{ position: 'relative', height: 340, borderRadius: 22, background: BG2, border: `1px solid ${LN}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%,rgba(15,181,172,0.10),transparent 62%)' }} />
              <svg viewBox="0 0 400 340" style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}>
                <g stroke="rgba(15,181,172,0.35)" strokeWidth="1.5">
                  <line x1="200" y1="170" x2="90" y2="70" /><line x1="200" y1="170" x2="310" y2="70" />
                  <line x1="200" y1="170" x2="60" y2="220" /><line x1="200" y1="170" x2="340" y2="220" />
                  <line x1="200" y1="170" x2="140" y2="290" /><line x1="200" y1="170" x2="260" y2="290" />
                </g>
              </svg>
              {[{t:'16%',r:'14%'},{t:'16%',l:'14%'},{t:'52%',r:'4%'},{t:'52%',l:'4%'},{b:'8%',r:'26%'},{b:'8%',l:'26%'}].map((pos,k) => (
                <div key={k} style={{ position: 'absolute', ...Object.fromEntries(Object.entries(pos).map(([k,v])=>[k,v])), width: 50, height: 50, borderRadius: '50%', background: BG2, border: `1px solid rgba(0,35,111,0.18)` }} />
              ))}
              <div style={{ position: 'relative', width: 78, height: 78, borderRadius: 18, background: `linear-gradient(140deg,${DK},${A})`, display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 900, color: '#fff', boxShadow: `0 0 36px rgba(15,181,172,0.50)`, zIndex: 2 }}>المزوّد</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ borderTop: `1px solid ${LN}` }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 40px' }}>
          <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 60px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: A, letterSpacing: '.5px', marginBottom: 14 }}>آلية العمل</div>
            <h2 style={{ fontSize: 'clamp(30px,4vw,48px)', lineHeight: 1.18, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 18px' }}>من المخزون إلى الإيراد، في أربع خطوات.</h2>
            <p style={{ fontSize: 19, lineHeight: 1.8, color: MU, margin: 0 }}>تدير رافد كل خطوة بينما تحتفظ أنت بالسيطرة المالية الكاملة على شبكتك مهما اتّسعت.</p>
          </div>

          <div className="rfd-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20, position: 'relative' }}>
            <div className="rfd-steps-line" style={{ position: 'absolute', top: 31, right: '11%', left: '11%', height: 2, background: `linear-gradient(90deg,rgba(0,35,111,0.06),rgba(15,181,172,0.35),rgba(0,35,111,0.06))` }} />
            {[
              { n: '1', label: 'رفع المخزون',    body: 'ارفع دفعات البطاقات وحدّد فئاتها وأسعارها.', active: true  },
              { n: '2', label: 'اعتماد الموزّعين', body: 'وافق على من ينضمّ وحدّد مستوياتهم وعمولاتهم.', active: false },
              { n: '3', label: 'بيع تلقائي',      body: 'يشتري الموزّعون برصيدهم وتُسلَّم البطاقات فوراً.', active: false },
              { n: '4', label: 'تحديث لحظي',     body: 'تنعكس كل حركة في لوحاتك وتقاريرك المالية فوراً.', active: false, highlight: true },
            ].map(({ n, label, body, active, highlight }) => (
              <div key={n} style={{ textAlign: 'center', position: 'relative' }}>
                <div style={{
                  width: 64, height: 64, margin: '0 auto 22px', borderRadius: '50%',
                  background: active ? `linear-gradient(140deg,${DK},${A})` : '#fff',
                  border: highlight ? `2px solid ${A}` : active ? 'none' : `1px solid rgba(0,35,111,0.18)`,
                  color: active ? '#fff' : A,
                  display: 'grid', placeItems: 'center',
                  fontSize: 20, fontWeight: 900,
                  boxShadow: active ? `0 0 22px rgba(15,181,172,0.40)` : highlight ? `0 0 0 5px rgba(15,181,172,0.10)` : 'none',
                  position: 'relative', zIndex: 2,
                }}>{n}</div>
                <h3 style={{ fontSize: 19, fontWeight: 800, margin: '0 0 8px' }}>{label}</h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: MU, margin: 0 }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DUPLICATE PROTECTION ── */}
      <section id="dup" style={{ borderTop: `1px solid ${LN}`, background: BG2 }}>
        <div className="rfd-dup-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '96px 40px', display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: A, letterSpacing: '.5px', marginBottom: 14 }}>الميزة الجوهرية</div>
            <h2 style={{ fontSize: 'clamp(30px,4vw,48px)', lineHeight: 1.16, fontWeight: 900, letterSpacing: '-1px', margin: '0 0 20px' }}>نمنع تكرار البطاقات قبل أن يكلّفك.</h2>
            <p style={{ fontSize: 19, lineHeight: 1.8, color: MU, margin: '0 0 28px' }}>كل بطاقة تُرفع تُقارَن ببصمة تاريخية لكل بطاقة عرفها النظام عبر كامل الشبكة. التكرار يُكتشف ويُرفض قبل أن يدخل مخزونك.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                ['بصمة فريدة لكل بطاقة',    'تعريف دقيق دون كشف أي بيانات حسّاسة.'],
                ['تحقّق تاريخي شامل',        'مقارنة عبر كامل الشبكة، لا داخل دفعتك فقط.'],
                ['رفض فوري للمكرّر',         'صفر بطاقات مكرّرة تدخل مخزونك أو تصل لموزّعيك.'],
              ].map(([title, body]) => (
                <div key={title} style={{ display: 'flex', gap: 13, alignItems: 'flex-start' }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, background: A, display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2, color: '#fff', fontSize: 13, fontWeight: 900 }}>✓</span>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
                    <div style={{ fontSize: 15, color: MU, lineHeight: 1.6 }}>{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: `1px solid rgba(0,35,111,0.12)`, borderRadius: 22, padding: 36, boxShadow: '0 40px 90px -40px rgba(10,31,77,0.18)', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: MU2, marginBottom: 8 }}>بطاقات مكرّرة دخلت شبكتك</div>
            <div style={{ fontSize: 96, lineHeight: 1, fontWeight: 900, color: A, letterSpacing: '-2px', marginBottom: 8 }}>صفر</div>
            <div style={{ fontSize: 16, color: MU, lineHeight: 1.6, marginBottom: 28 }}>صفر تسريب · صفر مبيعات ضائعة · صفر شكاوى عملاء</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, borderTop: `1px solid rgba(0,35,111,0.08)`, paddingTop: 24 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: INK }}>312</div>
                <div style={{ fontSize: 13, color: MU2, marginTop: 4 }}>مكرّر مرفوض هذا الشهر</div>
              </div>
              <div style={{ flex: 1, borderRight: `1px solid rgba(0,35,111,0.08)` }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: INK }}>840K</div>
                <div style={{ fontSize: 13, color: MU2, marginTop: 4 }}>بطاقة مفحوصة</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="cta" style={{ position: 'relative', borderTop: `1px solid ${LN}`, overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '110px 40px', textAlign: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 640, height: 420, background: `radial-gradient(circle,${GLOW},transparent 66%)`, filter: 'blur(40px)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{ fontSize: 'clamp(34px,5vw,60px)', lineHeight: 1.1, fontWeight: 900, letterSpacing: '-1.4px', margin: '0 0 20px' }}>
              جاهز لتوزيع <span style={{ color: A }}>تثق به؟</span>
            </h2>
            <p style={{ fontSize: 20, lineHeight: 1.7, color: MU, maxWidth: 600, margin: '0 auto 36px' }}>
              شاهد كيف يمنح رافد فريقك سيطرة كاملة على شبكة التوزيع — وحماية تاريخية لا توفّرها أي طريقة تقليدية.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="rfd-cta-primary" style={{ fontSize: 18, padding: '18px 36px', boxShadow: '0 16px 38px rgba(0,35,111,0.26)' }}>اطلب عرضاً تقديمياً</button>
              <button className="rfd-cta-outline" style={{ fontSize: 18, padding: '18px 36px' }}>تحدّث إلى المبيعات</button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: `1px solid ${LN}`, background: BG2 }}>
        <div className="rfd-footer-inner" style={{ maxWidth: 1200, margin: '0 auto', padding: '54px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 40, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
              <span style={{ width: 26, height: 26, borderRadius: 8, background: `linear-gradient(140deg,${DK},${A})`, transform: 'rotate(45deg)', display: 'block' }} />
              <span style={{ fontSize: 23, fontWeight: 900 }}>رافد</span>
            </div>
            <p style={{ fontSize: 14.5, color: MU, lineHeight: 1.7, margin: '0 0 12px' }}>البنية التحتية لتوزيع البطاقات مسبقة الدفع — للمؤسسات التي لا تقبل المساومة على السيطرة.</p>
            <a href="tel:+218944513974" style={{ fontSize: 14.5, color: MU, direction: 'ltr', display: 'inline-block', fontWeight: 600 }}>+218-944513974</a>
          </div>
          <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: MU2, marginBottom: 4 }}>المنصة</div>
              <a href="#features" className="rfd-footer-link">القدرات</a>
              <a href="#distributors" className="rfd-footer-link">شبكة الموزّعين</a>
              <a href="#dup" className="rfd-footer-link">الحماية من التكرار</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: MU2, marginBottom: 4 }}>تواصل معنا</div>
              <a href="tel:+218944513974" className="rfd-footer-link" style={{ direction: 'ltr', display: 'inline-block' }}>+218-944513974</a>
              <a href="/login" className="rfd-footer-link">تسجيل الدخول</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${LN}`, padding: '22px 40px', maxWidth: 1200, margin: '0 auto', fontSize: 13, color: MU2 }}>© 2026 رافد. جميع الحقوق محفوظة · مستند لتقنية المعلومات</div>
      </footer>

      <ScrollToTopButton />
    </div>
  );
}
