/* eslint-disable */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock framer-motion so animation props don't fail in jsdom
vi.mock('framer-motion', () => {
  const React = require('react');

  const make = (tag: string) =>
    React.forwardRef(
      (
        {
          children,
          initial,
          animate,
          exit,
          transition,
          variants,
          whileHover,
          whileTap,
          whileInView,
          viewport,
          custom,
          layout,
          layoutId,
          ...props
        }: any,
        ref: any
      ) => React.createElement(tag, { ...props, ref }, children)
    );

  return {
    motion: {
      div: make('div'),
      span: make('span'),
      button: make('button'),
      path: make('path'),
      circle: make('circle'),
    },
    AnimatePresence: ({ children }: any) => children,
    useAnimation: () => ({ start: vi.fn() }),
    useInView: () => true,
  };
});
