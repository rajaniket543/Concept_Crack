import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getAuthSession } from '../lib/auth';
import { pathFor, type PageKey } from '../lib/pages';
import { useToast } from '../components/Toast';

const CATEGORIES = ['General query', 'Technical issue', 'Test / exam problem', 'Account & login', 'Billing', 'Feedback'];

const CONTACT_CHANNELS = [
  { icon: 'mail',        label: 'Email',        value: 'support@conceptcrack.app', href: 'mailto:support@conceptcrack.app' },
  { icon: 'call',        label: 'Phone',        value: '+91 98765 43210',          href: 'tel:+919876543210' },
  { icon: 'schedule',    label: 'Support hours', value: 'Mon–Sat · 9 AM – 7 PM IST', href: null },
];

export default function ContactUs() {
  const navigate = useNavigate();
  const toast = useToast();
  const session = getAuthSession();

  const [name, setName]         = useState(session?.user?.name ?? '');
  const [email, setEmail]       = useState(session?.user?.email ?? '');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject]   = useState('');
  const [message, setMessage]   = useState('');
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);

  const role = session?.user?.role ?? 'student';
  const dashboardPath = pathFor(role as PageKey);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      toast('Please fill in every field before sending.', 'error');
      return;
    }
    setSending(true);
    try {
      await addDoc(collection(db, 'contactMessages'), {
        name: name.trim(),
        email: email.trim(),
        role,
        userId: session?.user?.id ?? null,
        category,
        subject: subject.trim(),
        message: message.trim(),
        status: 'open',
        createdAt: serverTimestamp(),
      });
      setSent(true);
      toast('Message sent — our team will get back to you.', 'success');
    } catch (err) {
      console.error(err);
      toast('Could not send your message. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <TopBar
        breadcrumb={[{ label: 'Contact Us' }]}
        actions={
          <button type="button" onClick={() => navigate(dashboardPath)} className="btn-outline btn-md flex items-center gap-1.5">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
            Dashboard
          </button>
        }
      />

      <div className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-display-sm font-headline" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', color: 'var(--text-primary)' }}>
              Contact Us
            </h1>
            <p className="text-body-md mt-1" style={{ color: 'var(--text-muted)' }}>
              Questions, problems or feedback — write to the Concept Crack team and we'll respond by email.
            </p>
          </div>

          {/* Contact channels */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {CONTACT_CHANNELS.map(c => (
              <div key={c.label} className="card flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(91,79,232,0.10)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#5B4FE8' }}>{c.icon}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-label-sm uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>{c.label}</div>
                  {c.href ? (
                    <a href={c.href} className="text-body-md font-semibold hover:underline break-all" style={{ color: 'var(--text-primary)' }}>{c.value}</a>
                  ) : (
                    <div className="text-body-md font-semibold" style={{ color: 'var(--text-primary)' }}>{c.value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          {sent ? (
            <Card>
              <div className="py-10 text-center">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#059669' }}>mark_email_read</span>
                </div>
                <h2 className="text-headline-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Message received</h2>
                <p className="text-body-md mb-6" style={{ color: 'var(--text-muted)' }}>
                  Thanks, {name.split(' ')[0]}. Our team will reply to <strong>{email}</strong> shortly.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={() => { setSent(false); setSubject(''); setMessage(''); }} className="btn-outline btn-md">
                    Send another message
                  </button>
                  <button type="button" onClick={() => navigate(dashboardPath)} className="btn-primary btn-md" style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}>
                    Back to dashboard
                  </button>
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Send us a message" subtitle="We usually reply within one working day">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Your name">
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required />
                  </Field>
                  <Field label="Email address">
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
                  </Field>
                  <Field label="Category">
                    <select value={category} onChange={e => setCategory(e.target.value)}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field label="Subject">
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief summary" required />
                  </Field>
                </div>
                <Field label="Message">
                  <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5} placeholder="Describe your question or issue…" required />
                </Field>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sending}
                    className="btn-primary btn-md flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #5B4FE8, #7C3AED)' }}
                  >
                    {sending ? <Spinner size={16} color="#fff" /> : <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>send</span>}
                    {sending ? 'Sending…' : 'Send message'}
                  </button>
                </div>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <div
        className="[&>input]:w-full [&>input]:bg-transparent [&>input]:outline-none [&>input]:text-sm [&>select]:w-full [&>select]:bg-transparent [&>select]:outline-none [&>select]:text-sm [&>textarea]:w-full [&>textarea]:bg-transparent [&>textarea]:outline-none [&>textarea]:text-sm [&>textarea]:resize-none"
        style={{
          backgroundColor: 'var(--surface-muted)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '9px 12px',
          color: 'var(--text-primary)',
        }}
      >
        {children}
      </div>
    </label>
  );
}
