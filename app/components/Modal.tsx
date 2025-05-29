import React from 'react';

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

export function Modal({ children, onClose }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white border-4 border-black p-8 max-w-md w-full">
        <button onClick={onClose} className="float-right bg-white text-black border-2 border-black px-2 py-1 font-extrabold hover:bg-black hover:text-white transition-all duration-100">×</button>
        {children}
      </div>
    </div>
  );
}