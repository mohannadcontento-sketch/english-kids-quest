/* Design reminder — “حكاية الورق الملوّن”: a focused storybook entry page, not a dashboard. */
import { ArrowLeft, BookOpen, Gamepad2, Leaf, ListChecks, Sparkles, Star, Trophy } from "lucide-react";
import { Link } from "wouter";
import { withBase, withAssetV } from "@/lib/base";

const heroImage = withBase(withAssetV("/img/hero-paper.jpg"));
const logoImage = withBase(withAssetV("/img/mascot-logo.png"));

export default function Home() {
  return <div className="quest-app landing-app" dir="rtl">
    <div className="paper-speckle" aria-hidden="true" />
    <header className="topbar container landing-topbar">
      <Link className="brand" href="/" aria-label="English Kids Quest"><span className="brand-mark"><img src={logoImage} alt="" /></span><span className="brand-copy"><strong>English Kids Quest</strong><small>نتعلّمها باللعب</small></span></Link>
      <Link className="landing-progress-link" href="/progress"><Trophy size={16} /> تقدّمي</Link>
    </header>
    <main>
      <section className="landing-hero container">
        <div className="landing-hero-copy"><p className="eyebrow"><span className="eyebrow-dot" /> رحلة إنجليزية صغيرة كل يوم</p><h1>اختر مغامرتك.<br /><em>وتعلّم باللعب.</em></h1><p>كل صفحة فيها مهمة واحدة فقط، ليبقى تركيز الطفل عاليًا وتجربته ممتعة.</p><Link className="primary-button" href="/letters">ابدأ بالحروف <ArrowLeft size={18} /></Link><span className="landing-age"><Sparkles size={15} /> مناسبة لعمر 5–9 سنوات</span></div>
        <div className="landing-hero-art"><img src={heroImage} alt="دفتر ملوّن مع حروف إنجليزية وشخصية ورقة لطيفة" /><span className="landing-sticker">اليوم<br />أتعلم!</span></div>
      </section>
      <section className="landing-choices container" aria-label="اختر صفحة التعلم">
        <Link className="landing-choice choice-letters" href="/letters"><span className="choice-icon"><BookOpen size={24} /></span><span><small>01 · درس صغير</small><b>حديقة الحروف</b><p>اسمع، قل، ثم اختبر أذنك.</p></span><ArrowLeft size={18} /></Link>
        <Link className="landing-choice choice-sentences" href="/sentences"><span className="choice-icon"><ListChecks size={24} /></span><span><small>02 · كلام يومي</small><b>دفتر الجمل</b><p>50 جملة سهلة نستخدمها كل يوم.</p></span><ArrowLeft size={18} /></Link>
        <Link className="landing-choice choice-games" href="/games"><span className="choice-icon"><Gamepad2 size={24} /></span><span><small>03 · مكافآت</small><b>ساحة الألعاب</b><p>3 ألعاب قصيرة ونجوم كثيرة.</p></span><ArrowLeft size={18} /></Link>
        <Link className="landing-choice choice-progress" href="/progress"><span className="choice-icon"><Star size={24} /></span><span><small>04 · رحلتي</small><b>لوحة التقدّم</b><p>شاهد نجومك وما أنجزته.</p></span><ArrowLeft size={18} /></Link>
      </section>
      <section className="landing-note container"><Leaf size={19} /><span>نصيحة اليوم: مهمة واحدة صغيرة أفضل من درس طويل.</span></section>
    </main>
  </div>;
}
