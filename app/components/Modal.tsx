import React from 'react';

export function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <button onClick={onClose} className="float-right text-gray-500 hover:text-gray-700">&times;</button>
        {children}
      </div>
    </div>
  );
}