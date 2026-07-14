import React from "react";

export function Logo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="accentGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F97316" />
          <stop offset="30%" stopColor="#F59E0B" />
          <stop offset="70%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F97316" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#10B981" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="220" cy="220" r="140" fill="url(#glowGrad)" />
      <circle cx="220" cy="220" r="110" fill="none" stroke="url(#ringGrad)" strokeWidth="28" strokeLinecap="round" />
      <path d="M300 300 L390 390" stroke="url(#ringGrad)" strokeWidth="28" strokeLinecap="round" />
      <path d="M340 100 C340 120 324 136 304 136 C324 136 340 152 340 172 C340 152 356 136 376 136 C356 136 340 120 340 100 Z" fill="url(#accentGrad)" />
      <path d="M220 170 L226 210 L266 216 L226 222 L220 262 L214 222 L174 216 L214 210 Z" fill="url(#accentGrad)" />
    </svg>
  );
}
