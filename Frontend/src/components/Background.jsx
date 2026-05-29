import React from 'react';

export default function Background() {
  if (window.location.pathname.startsWith('/admin')) return null;

  return (
    <div className="bg-gradient-wrapper">
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>
    </div>
  );
}
