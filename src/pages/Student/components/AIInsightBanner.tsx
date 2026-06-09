import { ReactNode } from 'react';

interface AIInsightBannerProps {
  tone: 'primary' | 'primary-container' | 'gradient';
  title: string;
  body?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

const TONE_WRAPPER: Record<AIInsightBannerProps['tone'], string> = {
  primary: 'bg-primary text-on-primary rounded-xl shadow-md',
  'primary-container': 'bg-primary-container text-on-primary-container p-card rounded-xl shadow-lg relative overflow-hidden',
  gradient:
    'bg-gradient-to-br from-primary to-primary-container text-white rounded-3xl p-8 md:p-12 relative overflow-hidden',
};

const TONE_BODY: Record<AIInsightBannerProps['tone'], string> = {
  primary: 'opacity-80',
  'primary-container': 'text-on-primary-container',
  gradient: 'text-white/80',
};

export default function AIInsightBanner({
  tone,
  title,
  body,
  children,
  action,
  className = '',
}: AIInsightBannerProps) {
  return (
    <div className={`${TONE_WRAPPER[tone]} ${className}`}>
      {tone === 'primary-container' && (
        <div className="absolute top-0 right-0 w-64 h-64 bg-secondary opacity-20 blur-[100px] -mr-32 -mt-32" />
      )}
      {tone === 'gradient' && (
        <>
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute left-1/4 bottom-0 w-60 h-60 bg-secondary/10 rounded-full blur-2xl" />
        </>
      )}
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            auto_awesome
          </span>
          <h3 className="font-title-lg text-title-lg">{title}</h3>
        </div>
        {body && <p className={`text-body-lg ${TONE_BODY[tone]} max-w-2xl`}>{body}</p>}
        {children}
      </div>
      {action && <div className="relative z-10 mt-6">{action}</div>}
    </div>
  );
}
