import React from 'react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`p-6 max-w-7xl mx-auto w-full space-y-6 ${className}`}>
      {children}
    </div>
  );
};
