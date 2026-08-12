/**
 * PricingPage — صفحة الأسعار
 * Translated from Rafed Design project (Pricing.dc.html)
 * Accent: #0FB5AC | Navy: #00236F | BG: #F6F8FD
 */

const ACCENT  = '#0FB5AC';
const NAVY    = '#00236F';
const BG      = '#F6F8FD';
const INK     = '#0A1F4D';
const MU      = '#586A8C';
const MU2     = '#8A95B2';
const LN      = 'rgba(0,35,111,0.10)';
const LIGHT   = '#EEF2FB';

const FEATURES = [
  'تكامل عبر API مع الموزّعين',
  'إمكانية تصدير حزمة بطاقات في ملف Excel',
  'الحماية من تكرار البطاقات',
  'موزّعون ومستويات عمولة بلا حدود',
  'حدود ائتمانية للموزّعين',
  'تقارير مالية وتسويات تلقائية',
  'صلاحيات فريق وأدوار مخصّصة',
];

function CheckIcon({ dark = false, featured = false }: { dark?: boolean; featured?: boolean }) {
  const bg = dark
    ? 'rgba(255,255,255,0.14)'
    : featured
    ? ACCENT
    : `rgba(15,181,172,0.14)`;
  const color = dark ? ACCENT : featured ? '#fff' : ACCENT;
  return (
    <span style={{
      width: 20, height: 20, borderRadius: 6, background: bg, color,
      display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 2,
      fontSize: 11, fontWeight: 900,
    }}>✓</span>
  );
}

function FeatureList({ dark = false, featured = false }: { dark?: boolean; featured?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {FEATURES.map((f) => (
        <div key={f} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 15.5, lineHeight: 1.6, color: dark ? '#fff' : undefined }}>
          <CheckIcon dark={dark} featured={featured} />
          <span>{f}</span>
        </div>
      ))}
    </div>
  );
}

export default function PricingPage() {
  return (
    <div
      dir="rtl"
      lang="ar"
      style={{
        background: BG, color: INK,
        fontFamily: "'Tajawal',system-ui,sans-serif",
        minHeight: '100vh', overflowX: 'hidden',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <style>{`
        @keyframes rfdGlow{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:.9;transform:scale(1.05)}}
        .rfd-nav-link{transition:color .2s;color:${MU};font-size:clamp(14px,1.4vw,16px);font-weight:500;}
        .rfd-nav-link:hover{color:${INK};}
        .rfd-card-plain{transition:transform .25s,border-color .25s;}
        .rfd-card-plain:hover{transform:translateY(-4px);border-color:rgba(0,35,111,0.20);}
        .rfd-card-dark{transition:transform .25s;}
        .rfd-card-dark:hover{transform:translateY(-4px);}
        .rfd-btn-nav{background:${NAVY};color:#fff;font-weight:800;font-size:clamp(13px,1.3vw,15px);padding:11px clamp(14px,2vw,22px);border-radius:11px;box-shadow:0 8px 22px rgba(0,35,111,0.22);transition:transform .2s;white-space:nowrap;display:inline-block;}
        .rfd-btn-nav:hover{transform:translateY(-2px);}
        .rfd-btn-plain{display:block;text-align:center;background:#fff;color:${INK};font-weight:800;font-size:16px;padding:15px;border-radius:12px;border:1px solid rgba(0,35,111,0.18);margin-bottom:28px;transition:border-color .2s;}
        .rfd-btn-plain:hover{border-color:${ACCENT};}
        .rfd-btn-navy{display:block;text-align:center;background:${NAVY};color:#fff;font-weight:800;font-size:16px;padding:15px;border-radius:12px;box-shadow:0 14px 32px rgba(0,35,111,0.24);margin-bottom:28px;transition:transform .2s;}
        .rfd-btn-navy:hover{transform:translateY(-2px);}
        .rfd-btn-accent{display:block;text-align:center;background:${ACCENT};color:${NAVY};font-weight:900;font-size:16px;padding:15px;border-radius:12px;box-shadow:0 14px 32px rgba(15,181,172,0.30);margin-bottom:28px;transition:transform .2s;}
        .rfd-btn-accent:hover{transform:translateY(-2px);}
        .rfd-cta-navy{background:${NAVY};color:#fff;font-weight:800;font-size:clamp(15px,1.7vw,17px);padding:17px clamp(24px,3.4vw,34px);border-radius:13px;box-shadow:0 16px 38px rgba(0,35,111,0.26);transition:transform .2s;display:inline-block;}
        .rfd-cta-navy:hover{transform:translateY(-3px);}
        .rfd-cta-outline{background:#fff;color:${INK};font-weight:700;font-size:clamp(15px,1.7vw,17px);padding:17px clamp(24px,3.4vw,34px);border-radius:13px;border:1px solid rgba(0,35,111,0.18);transition:border-color .2s;display:inline-block;}
        .rfd-cta-outline:hover{border-color:${ACCENT};}
        .rfd-footer-link{font-size:14.5px;color:${MU};transition:color .2s;}
        .rfd-footer-link:hover{color:${INK};}
      `}</style>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(18px)',
        background: 'rgba(246,248,253,0.82)',
        borderBottom: `1px solid ${LN}`,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '14px clamp(16px,4vw,40px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 'clamp(12px,2vw,32px)', flexWrap: 'wrap',
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 30, height: 30, borderRadius: 9,
              background: `linear-gradient(140deg,${NAVY},${ACCENT})`,
              display: 'inline-block', transform: 'rotate(45deg)',
              boxShadow: '0 0 22px rgba(15,181,172,0.40)',
            }} />
            <span style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}>رافد</span>
          </a>

          <div style={{
            display: 'flex', alignItems: 'center',
            gap: 'clamp(16px,2.6vw,34px)', flexWrap: 'wrap', justifyContent: 'center',
          }}>
            <a href="/" className="rfd-nav-link">المنصة</a>
            <a href="/#features" className="rfd-nav-link">القدرات</a>
            <a href="/pricing" style={{ color: INK, fontWeight: 700, fontSize: 'clamp(14px,1.4vw,16px)' }}>الأسعار</a>
          </div>

          <a href="/login" className="rfd-btn-nav">اطلب عرضاً تقديمياً</a>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header style={{
        position: 'relative', maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(52px,8vw,88px) clamp(20px,4vw,40px) 0',
        textAlign: 'center',
      }}>
        {/* Glow blob */}
        <div style={{
          position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)',
          width: 'min(680px,120vw)', height: 'min(420px,60vh)',
          background: 'radial-gradient(circle,rgba(15,181,172,0.20),transparent 66%)',
          filter: 'blur(36px)', pointerEvents: 'none',
          animation: 'rfdGlow 8s ease-in-out infinite',
        }} />
        <div style={{ position: 'relative' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 9,
            padding: '8px 16px', border: `1px solid rgba(0,35,111,0.18)`,
            borderRadius: 999, fontSize: 14, fontWeight: 600, color: MU, marginBottom: 26,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: ACCENT,
              boxShadow: `0 0 10px ${ACCENT}`,
            }} />
            الأسعار
          </div>
          <h1 style={{
            fontSize: 'clamp(30px,6.2vw,66px)', lineHeight: 1.12, fontWeight: 900,
            letterSpacing: '-1.2px', margin: '0 auto 20px', maxWidth: 820,
          }}>
            تسعير يواكب حجم{' '}
            <span style={{ color: ACCENT }}>شبكتك.</span>
          </h1>
          <p style={{
            fontSize: 'clamp(16px,2vw,20px)', lineHeight: 1.8, color: MU,
            maxWidth: 620, margin: '0 auto 20px',
          }}>
            ابدأ بما تحتاجه اليوم وتوسّع حين تتوسّع شبكتك. كل الخطط تشمل الحماية من تكرار البطاقات.
          </p>
        </div>
      </header>

      {/* ── Plans ── */}
      <section style={{
        maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(32px,5vw,48px) clamp(16px,4vw,40px) clamp(60px,8vw,100px)',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))',
          gap: 20, alignItems: 'stretch',
        }}>

          {/* ── PLAN 1: الأساسية ── */}
          <div className="rfd-card-plain" style={{
            background: '#fff', border: `1px solid rgba(0,35,111,0.12)`,
            borderRadius: 20, padding: 'clamp(22px,2.6vw,30px) 34px',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: MU2, marginBottom: 10 }}>الأساسية</div>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: MU, margin: '0 0 24px', minHeight: 50 }}>
              لمزوّدي البطاقات الذين يبنون شبكة توزيعهم الأولى.
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 26, minHeight: 64 }}>
              <span style={{ fontSize: 48, lineHeight: 1, fontWeight: 900, letterSpacing: -2, direction: 'ltr' }}>4,000</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: MU, paddingBottom: 6, whiteSpace: 'nowrap' }}>د.ل / سنوياً</span>
            </div>
            <div style={{
              background: '#F4F7FD', border: `1px solid rgba(0,35,111,0.10)`,
              borderRadius: 14, padding: '16px 18px', marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: MU2, marginBottom: 6 }}>حد بيع البطاقات</div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, whiteSpace: 'nowrap' }}>
                <span style={{ unicodeBidi: 'isolate', direction: 'ltr' }}>50,000</span>
                {' '}<span style={{ fontSize: 15, fontWeight: 700, color: MU }}>بطاقة / سنوياً</span>
              </div>
            </div>
            <a href="/login" className="rfd-btn-plain">ابدأ الآن</a>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: MU2, marginBottom: 14 }}>كل ميزات المنصة، بلا استثناء:</div>
            <FeatureList />
          </div>

          {/* ── PLAN 2: الاحترافية (featured) ── */}
          <div style={{
            background: '#fff', border: `2px solid ${ACCENT}`,
            borderRadius: 20, padding: 'clamp(22px,2.6vw,30px) 34px',
            display: 'flex', flexDirection: 'column',
            position: 'relative', boxShadow: '0 40px 90px -40px rgba(10,31,77,0.28)',
          }}>
            <div style={{
              position: 'absolute', top: -13, right: 30,
              background: `linear-gradient(140deg,${NAVY},${ACCENT})`,
              color: '#fff', fontSize: 13, fontWeight: 800,
              padding: '6px 15px', borderRadius: 999,
              boxShadow: '0 8px 20px rgba(0,35,111,0.24)',
            }}>الأنسب</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, marginBottom: 10 }}>الاحترافية</div>
            <p style={{ fontSize: 15, lineHeight: 1.65, color: MU, margin: '0 0 24px', minHeight: 50 }}>
              للمزوّدين الذين يديرون حجم توزيع أكبر عبر شبكة واسعة.
            </p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 26, minHeight: 64 }}>
              <span style={{ fontSize: 48, lineHeight: 1, fontWeight: 900, letterSpacing: -2, direction: 'ltr' }}>6,000</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: MU, paddingBottom: 6, whiteSpace: 'nowrap' }}>د.ل / سنوياً</span>
            </div>
            <div style={{
              background: 'rgba(15,181,172,0.09)', border: '1px solid rgba(15,181,172,0.28)',
              borderRadius: 14, padding: '16px 18px', marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>حد بيع البطاقات</div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8, whiteSpace: 'nowrap' }}>
                <span style={{ unicodeBidi: 'isolate', direction: 'ltr' }}>200,000</span>
                {' '}<span style={{ fontSize: 15, fontWeight: 700, color: MU }}>بطاقة / سنوياً</span>
              </div>
            </div>
            <a href="/login" className="rfd-btn-navy">ابدأ الآن</a>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: MU2, marginBottom: 14 }}>كل ميزات المنصة، بلا استثناء:</div>
            <FeatureList featured />
          </div>

          {/* ── PLAN 3: المؤسسات الكبيرة ── */}
          <div className="rfd-card-dark" style={{
            background: NAVY, color: '#fff',
            border: `1px solid ${NAVY}`,
            borderRadius: 20, padding: 'clamp(22px,2.6vw,30px) 34px',
            display: 'flex', flexDirection: 'column',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Glow blob */}
            <div style={{
              position: 'absolute', top: -90, left: -60,
              width: 280, height: 280,
              background: 'radial-gradient(circle,rgba(15,181,172,0.34),transparent 68%)',
              filter: 'blur(30px)', pointerEvents: 'none',
            }} />
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, marginBottom: 10 }}>المؤسسات الكبيرة</div>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,0.72)', margin: '0 0 24px', minHeight: 50 }}>
                لشبكات التوزيع الكبيرة التي تتجاوز أحجامها الخطط القياسية.
              </p>
              <div style={{
                fontSize: 'clamp(28px,3.4vw,40px)', lineHeight: 1, fontWeight: 900,
                letterSpacing: -1.2, marginBottom: 26, minHeight: 64, display: 'flex', alignItems: 'flex-end',
              }}>
                تسعير مخصّص
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 14, padding: '16px 18px', marginBottom: 24,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT, marginBottom: 6 }}>حد بيع البطاقات</div>
                <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.8 }}>بلا حدود</div>
              </div>
              <a href="/login" className="rfd-btn-accent">تواصل مع المبيعات</a>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'rgba(255,255,255,0.55)', marginBottom: 14 }}>
                كل ميزات المنصة، بلا استثناء:
              </div>
              <FeatureList dark />
            </div>
          </div>

        </div>

        <p style={{ textAlign: 'center', fontSize: 14.5, color: MU2, margin: '34px 0 0' }}>
          جميع الخطط تشمل ميزات المنصة كاملة — الفرق الوحيد هو عدد البطاقات التي يمكنك بيعها سنوياً.
        </p>
      </section>

      {/* ── FAQ ── */}
      <section style={{ borderTop: `1px solid ${LN}`, background: LIGHT }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          padding: 'clamp(56px,8vw,88px) clamp(20px,4vw,40px)',
        }}>
          <h2 style={{
            fontSize: 'clamp(24px,4.4vw,42px)', lineHeight: 1.2,
            fontWeight: 900, letterSpacing: -1, margin: '0 0 clamp(28px,4vw,44px)', textAlign: 'center',
          }}>
            أسئلة شائعة حول الأسعار
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))',
            gap: 20,
          }}>
            {[
              {
                q: 'كيف يُحتسب حد رفع البطاقات؟',
                a: 'بعدد البطاقات التي ترفعها إلى مخزونك خلال سنة الاشتراك. البطاقات المرفوضة كمكرّرة لا تُحتسب.',
              },
              {
                q: 'هل تختلف الميزات بين الخطط؟',
                a: 'لا. جميع الخطط تشمل ميزات المنصة كاملة — الفرق الوحيد هو عدد البطاقات المسموح برفعها سنوياً.',
              },
              {
                q: 'ماذا لو تجاوزت حد الرفع؟',
                a: 'ننبّهك قبل الوصول للحد، ويمكنك الترقية فوراً دون انقطاع في الخدمة أو فقدان بيانات.',
              },
              {
                q: 'كم يستغرق الإعداد؟',
                a: 'خلال دقائق معدودة يمكنك إعداد حسابك والبدء في استخدام المنصة.',
              },
            ].map(({ q, a }) => (
              <div key={q} style={{
                background: '#fff', border: `1px solid rgba(0,35,111,0.10)`,
                borderRadius: 16, padding: 26,
              }}>
                <h3 style={{ fontSize: 17.5, fontWeight: 800, margin: '0 0 10px' }}>{q}</h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.7, color: MU, margin: 0 }}>{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ position: 'relative', borderTop: `1px solid ${LN}`, overflow: 'hidden' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: 'clamp(64px,9vw,100px) clamp(20px,4vw,40px)',
          textAlign: 'center', position: 'relative',
        }}>
          {/* Glow blob */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: 'min(620px,120vw)', height: 'min(400px,55vh)',
            background: 'radial-gradient(circle,rgba(15,181,172,0.20),transparent 66%)',
            filter: 'blur(40px)', pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative' }}>
            <h2 style={{
              fontSize: 'clamp(26px,5.4vw,54px)', lineHeight: 1.14, fontWeight: 900,
              letterSpacing: -1.2, margin: '0 0 18px',
            }}>
              غير متأكد أي خطة{' '}
              <span style={{ color: ACCENT }}>تناسبك؟</span>
            </h2>
            <p style={{
              fontSize: 'clamp(16px,1.9vw,19px)', lineHeight: 1.7, color: MU,
              maxWidth: 560, margin: '0 auto 32px',
            }}>
              أخبرنا بحجم شبكتك وسنقترح الخطة المناسبة — دون التزام.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/login" className="rfd-cta-navy">تواصل مع المبيعات</a>
              <a href="/" className="rfd-cta-outline">شاهد المنصة</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: `1px solid ${LN}`, background: LIGHT }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: 'clamp(40px,6vw,54px) clamp(20px,4vw,40px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 'clamp(28px,5vw,40px)', flexWrap: 'wrap',
        }}>
          <div style={{ maxWidth: 300 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 16 }}>
              <span style={{
                width: 26, height: 26, borderRadius: 8,
                background: `linear-gradient(140deg,${NAVY},${ACCENT})`,
                transform: 'rotate(45deg)', display: 'inline-block',
              }} />
              <span style={{ fontSize: 23, fontWeight: 900 }}>رافد</span>
            </div>
            <p style={{ fontSize: 14.5, color: MU, lineHeight: 1.7, margin: 0 }}>
              البنية التحتية لتوزيع البطاقات مسبقة الدفع — للمؤسسات التي لا تقبل المساومة على السيطرة.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'clamp(32px,6vw,64px)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: MU2, marginBottom: 4 }}>المنصة</div>
              <a href="/" className="rfd-footer-link">القدرات</a>
              <a href="/#features" className="rfd-footer-link">الحماية من التكرار</a>
              <a href="/pricing" style={{ fontSize: 14.5, color: MU, fontWeight: 700 }}>الأسعار</a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: MU2, marginBottom: 4 }}>الشركة</div>
              <a href="/login" className="rfd-footer-link">القطاعات</a>
              <a href="/login" className="rfd-footer-link">تواصل معنا</a>
            </div>
          </div>
        </div>
        <div style={{
          borderTop: `1px solid ${LN}`, padding: '22px clamp(20px,4vw,40px)',
          maxWidth: 1200, margin: '0 auto', fontSize: 13, color: MU2,
        }}>
          © 2026 رافد. جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
}
