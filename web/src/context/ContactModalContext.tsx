'use client';

import React, { createContext, useContext, useState } from 'react';
import { ContactModal } from '@/components/ContactModal';

interface ContactModalContextType {
  openContactModal: () => void;
}

const ContactModalContext = createContext<ContactModalContextType | undefined>(undefined);

export const ContactModalProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openContactModal = () => setIsOpen(true);
  const closeContactModal = () => setIsOpen(false);

  return (
    <ContactModalContext.Provider value={{ openContactModal }}>
      {children}
      <ContactModal isOpen={isOpen} onClose={closeContactModal} />
    </ContactModalContext.Provider>
  );
};

export const useContactModal = () => {
  const context = useContext(ContactModalContext);
  if (!context) {
    throw new Error('useContactModal must be used within ContactModalProvider');
  }
  return context;
};
