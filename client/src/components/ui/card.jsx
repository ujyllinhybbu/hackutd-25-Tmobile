import React from "react";

export function Card({ className = "", children }) {
  return (
    <div className={`rounded-2xl bg-white border border-rose-200 shadow-[0_10px_30px_rgba(226,0,116,0.08)] ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}

export function CardTitle({ className = "", children }) {
  return <h3 className={`font-semibold leading-none tracking-tight ${className}`}>{children}</h3>;
}

export function CardContent({ className = "", children }) {
  return <div className={`p-4 pt-0 ${className}`}>{children}</div>;
}
