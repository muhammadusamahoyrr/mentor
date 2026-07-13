'use client';
import Image from "next/image";
import { Calendar, Clock, Heart, Shield, Users, ArrowRight, Phone, MapPin, Mail, Activity, TrendingUp, Zap, CheckCircle, Star, BrainCircuit, Stethoscope, Lock } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1 } }),
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f8fafc] selection:bg-blue-100 selection:text-blue-600">

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between py-4">
          <Logo withText size="md" />
          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-500">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#services" className="hover:text-blue-600 transition-colors">Services</a>
            <a href="#how" className="hover:text-blue-600 transition-colors">How it Works</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors px-4 py-2">
              Sign In
            </Link>
            <Link href="/register" className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:opacity-90 transition-all shadow-lg shadow-blue-200 active:scale-95">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="pt-24 pb-16 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[140px] -z-10" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-[140px] -z-10 animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <h1 className="text-5xl lg:text-6xl font-black text-slate-900 mb-5 leading-[1.08] tracking-tight mt-2">
              Your Health,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                In One Seamless Loop.
              </span>
            </h1>
            <p className="text-lg text-slate-500 mb-8 leading-relaxed font-medium max-w-lg">
              CareLoop connects patients and doctors with real-time transparency, automated scheduling, and compassionate care — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Link href="/register" className="inline-flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-base hover:opacity-90 transition-all shadow-xl shadow-blue-200 hover:-translate-y-1 active:scale-95">
                Join CareLoop <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
              <Link href="#how" className="inline-flex items-center justify-center glass text-slate-700 px-8 py-4 rounded-2xl font-bold text-base hover:bg-white transition-all border border-slate-200 hover:-translate-y-1 active:scale-95">
                How it Works
              </Link>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-8 pt-8 border-t border-slate-200">
              {[["5k+", "Active Patients"], ["200+", "Top Specialists"], ["98.2%", "Success Rate"]].map(([val, label]) => (
                <div key={label}>
                  <p className="text-2xl font-black text-slate-900">{val}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right – hero image + floating cards */}
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.2 }} className="relative">
            <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border-[6px] border-white group">
              <Image
                src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80"
                alt="Modern Healthcare"
                width={700} height={820}
                className="object-cover w-full transition-transform duration-700 group-hover:scale-105"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent" />
            </div>

            {/* Floating – System Status (top-right, inside image) */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute top-5 right-5 glass px-3 py-2 rounded-2xl shadow-lg border border-white/70 flex items-center gap-2"
            >
              <div className="h-7 w-7 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shrink-0">
                <Activity className="h-3.5 w-3.5 text-white" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">System Status</p>
                <p className="text-xs font-black text-emerald-500 flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping inline-block" />
                  Operational
                </p>
              </div>
            </motion.div>

            {/* Floating – Recovery (bottom-left, inside image) */}
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
              className="absolute bottom-5 left-5 glass px-3 py-2 rounded-2xl shadow-lg border border-white/70 flex items-center gap-2"
            >
              <div className="h-7 w-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Recovery</p>
                <p className="text-sm font-black text-slate-900 mt-0.5">98.2%</p>
              </div>
            </motion.div>

            {/* Floating – Next Appointment (bottom-right, inside image) */}
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity, delay: 1 }}
              className="absolute bottom-5 right-5 glass px-3 py-2 rounded-2xl shadow-lg border border-white/70 flex items-center gap-2"
            >
              <div className="h-7 w-7 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                <Clock className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-none">Next Appt.</p>
                <p className="text-xs font-black text-slate-900 mt-0.5">Dr. Sarah · 3:00 PM</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Trusted By Bar ─────────────────────────────────── */}
      <section className="py-8 border-y border-slate-200 bg-white/70">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Trusted by leading clinics</p>
          <div className="flex items-center gap-10 flex-wrap justify-center">
            {["MedCore", "HealthBridge", "NovaCare", "LifeLine", "PulseMD"].map(name => (
              <span key={name} className="text-slate-300 font-black text-lg tracking-tight">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Bento ─────────────────────────────────── */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Why CareLoop</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Everything You Need,<br />Nothing You Don&apos;t</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto font-medium">Built for patients and doctors alike, CareLoop removes friction at every step.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Big feature card */}
            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={0}
              className="md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2rem] p-10 text-white relative overflow-hidden group">
              <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/5 rounded-full group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/5 rounded-full" />
              <div className="p-3 bg-white/20 rounded-2xl w-fit mb-6"><Zap className="h-7 w-7 text-white" /></div>
              <h3 className="text-2xl font-black mb-3">Real-Time Appointment Sync</h3>
              <p className="text-blue-100 leading-relaxed max-w-md font-medium">Instant notifications, live slot updates, and two-way confirmations — so patients and doctors are always on the same page.</p>
              <div className="mt-8 flex gap-3">
                {["Instant Alerts", "Auto Reminders", "Zero No-Shows"].map(tag => (
                  <span key={tag} className="text-xs font-black bg-white/15 px-3 py-1.5 rounded-full">{tag}</span>
                ))}
              </div>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={1}
              className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all">
              <div className="p-3 bg-emerald-50 rounded-2xl w-fit mb-6"><Shield className="h-7 w-7 text-emerald-600" /></div>
              <h3 className="text-xl font-black text-slate-900 mb-3">HIPAA-Grade Security</h3>
              <p className="text-slate-500 font-medium leading-relaxed">End-to-end encryption and role-based access keeps every record private and compliant.</p>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={2}
              className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all">
              <div className="p-3 bg-blue-50 rounded-2xl w-fit mb-6"><BrainCircuit className="h-7 w-7 text-blue-600" /></div>
              <h3 className="text-xl font-black text-slate-900 mb-3">Smart Scheduling</h3>
              <p className="text-slate-500 font-medium leading-relaxed">Intelligent availability matching gets you the right specialist at the right time.</p>
            </motion.div>

            <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={3}
              className="md:col-span-2 bg-slate-900 rounded-[2rem] p-10 text-white relative overflow-hidden group">
              <div className="absolute -bottom-16 -right-16 w-72 h-72 bg-blue-600/10 rounded-full group-hover:scale-110 transition-transform duration-500" />
              <div className="p-3 bg-white/10 rounded-2xl w-fit mb-6"><Users className="h-7 w-7 text-white" /></div>
              <h3 className="text-2xl font-black mb-3">Unified Patient & Doctor Portal</h3>
              <p className="text-slate-400 leading-relaxed max-w-md font-medium">One platform, two tailored views. Patients book care; doctors manage their pipeline — with zero overlap or confusion.</p>
              <Link href="/register" className="mt-8 inline-flex items-center gap-2 text-sm font-black text-blue-400 hover:text-blue-300 transition-colors">
                Get started free <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Services ───────────────────────────────────────── */}
      <section id="services" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Our Expertise</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">World-Class Services</h2>
            <p className="text-slate-500 mt-4 max-w-xl mx-auto font-medium">Specialists across every major discipline, available at your fingertips.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Heart className="h-7 w-7" />, title: "Cardiology", desc: "Comprehensive heart care using the latest diagnostic tools and treatments.", color: "text-rose-600 bg-rose-50" },
              { icon: <Users className="h-7 w-7" />, title: "Family Medicine", desc: "Personalized healthcare for all ages, focusing on long-term wellness.", color: "text-blue-600 bg-blue-50" },
              { icon: <Activity className="h-7 w-7" />, title: "Emergency", desc: "24/7 rapid response team for critical medical situations.", color: "text-amber-600 bg-amber-50" },
              { icon: <Stethoscope className="h-7 w-7" />, title: "General Practice", desc: "Routine check-ups, referrals, and preventive care all in one place.", color: "text-emerald-600 bg-emerald-50" },
              { icon: <BrainCircuit className="h-7 w-7" />, title: "Neurology", desc: "Expert diagnosis and treatment for brain, spine, and nervous system disorders.", color: "text-indigo-600 bg-indigo-50" },
              { icon: <Shield className="h-7 w-7" />, title: "Preventive Care", desc: "Screenings, vaccinations, and lifestyle guidance to keep you ahead of illness.", color: "text-teal-600 bg-teal-50" },
            ].map((s, i) => (
              <motion.div key={s.title} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i * 0.5}
                whileHover={{ y: -6 }}
                className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-500/5 transition-all group">
                <div className={`w-14 h-14 ${s.color} rounded-2xl flex items-center justify-center mb-6`}>{s.icon}</div>
                <h4 className="text-xl font-black text-slate-900 mb-3">{s.title}</h4>
                <p className="text-slate-500 leading-relaxed font-medium text-sm">{s.desc}</p>
                <div className="mt-5 flex items-center gap-1 text-blue-600 text-sm font-black opacity-0 group-hover:opacity-100 transition-opacity">
                  Learn more <ArrowRight className="h-4 w-4" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it Works ───────────────────────────────────── */}
      <section id="how" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Simple Process</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">Up & Running in Minutes</h2>
          </div>

          <div className="grid md:grid-cols-4 gap-6 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-14 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-blue-200 via-indigo-300 to-blue-200 z-0" />

            {[
              { step: "01", icon: <Users className="h-6 w-6" />, title: "Create Account", desc: "Sign up as a patient or doctor in under 60 seconds." },
              { step: "02", icon: <Calendar className="h-6 w-6" />, title: "Book Appointment", desc: "Browse specialists and pick a time that works for you." },
              { step: "03", icon: <CheckCircle className="h-6 w-6" />, title: "Get Confirmed", desc: "Your doctor reviews and approves — you're notified instantly." },
              { step: "04", icon: <Heart className="h-6 w-6" />, title: "Receive Care", desc: "Attend your visit and track your health history over time." },
            ].map((item, i) => (
              <motion.div key={item.step} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i * 0.15}
                className="relative z-10 bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm text-center hover:shadow-xl hover:border-blue-100 transition-all">
                <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white shadow-lg shadow-blue-200">
                  {item.icon}
                </div>
                <span className="text-[10px] font-black text-blue-400 tracking-widest">{item.step}</span>
                <h4 className="text-lg font-black text-slate-900 mt-1 mb-2">{item.title}</h4>
                <p className="text-slate-500 text-sm font-medium leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Social Proof</p>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Loved by Patients & Doctors</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Sarah M.", role: "Patient", quote: "I booked my cardiologist in 3 minutes. The confirmation came before I even closed my phone. Incredible.", stars: 5, initials: "SM", color: "bg-rose-100 text-rose-600" },
              { name: "Dr. James K.", role: "Cardiologist", quote: "My entire appointment pipeline is now manageable. CareLoop cut my admin time by 60% in the first week.", stars: 5, initials: "JK", color: "bg-blue-100 text-blue-600" },
              { name: "Ayesha R.", role: "Patient", quote: "Real-time notifications mean I never miss a confirmation again. The interface is clean and intuitive.", stars: 5, initials: "AR", color: "bg-indigo-100 text-indigo-600" },
            ].map((t, i) => (
              <motion.div key={t.name} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i * 0.15}
                className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 hover:shadow-xl hover:border-blue-100 transition-all">
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 font-medium leading-relaxed mb-6 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full ${t.color} flex items-center justify-center font-black text-sm`}>{t.initials}</div>
                  <div>
                    <p className="font-black text-slate-900 text-sm">{t.name}</p>
                    <p className="text-xs text-slate-400 font-bold">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }}
            className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-[2.5rem] p-14 text-white text-center relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-72 h-72 bg-white/5 rounded-full" />
            <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-white/5 rounded-full" />
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-200 mb-4">Start Today</p>
              <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">Ready to Join the Loop?</h2>
              <p className="text-blue-100 max-w-lg mx-auto font-medium mb-10 text-lg leading-relaxed">
                Sign up free and experience healthcare management that actually works — for patients and providers alike.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/register" className="inline-flex items-center justify-center bg-white text-blue-600 px-10 py-4 rounded-2xl font-black text-base hover:bg-blue-50 transition-all shadow-xl hover:-translate-y-1 active:scale-95">
                  Create Free Account <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link href="/login" className="inline-flex items-center justify-center bg-white/10 backdrop-blur text-white border border-white/20 px-10 py-4 rounded-2xl font-bold text-base hover:bg-white/20 transition-all hover:-translate-y-1 active:scale-95">
                  Sign In
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="bg-slate-900 py-16 text-white overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="col-span-2">
              <Logo size="md" withText className="brightness-0 invert" />
              <p className="mt-5 text-slate-400 max-w-sm leading-relaxed font-medium text-sm">
                Transforming the healthcare experience through technology, empathy, and continuous innovation. Join the loop today.
              </p>
              <div className="mt-6 flex gap-3">
                {["HIPAA", "ISO 27001", "SOC 2"].map(badge => (
                  <span key={badge} className="text-[10px] font-black text-slate-500 border border-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                    <Lock className="h-3 w-3" /> {badge}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-black uppercase tracking-widest text-xs text-slate-300 mb-5">Contact</h4>
              <ul className="space-y-3 text-slate-400 font-medium text-sm">
                <li className="flex items-center gap-3"><Phone className="h-4 w-4 text-blue-400 shrink-0" /> +1 (555) 000-LOOP</li>
                <li className="flex items-center gap-3"><Mail className="h-4 w-4 text-blue-400 shrink-0" /> contact@careloop.com</li>
                <li className="flex items-center gap-3"><MapPin className="h-4 w-4 text-blue-400 shrink-0" /> Medical Center, New York</li>
              </ul>
            </div>
            <div>
              <h4 className="font-black uppercase tracking-widest text-xs text-slate-300 mb-5">Legal</h4>
              <ul className="space-y-3 text-slate-400 font-medium text-sm">
                {["Privacy Policy", "Terms of Service", "Cookie Policy"].map(item => (
                  <li key={item} className="hover:text-white cursor-pointer transition-colors">{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm font-bold">© 2026 CareLoop. All rights reserved.</p>
            <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">Built with ❤️ for better healthcare</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
