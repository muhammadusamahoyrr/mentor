import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Logo from '../components/Logo';

describe('Logo', () => {
  it('renders an SVG element', () => {
    const { container } = render(<Logo />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render brand text by default', () => {
    const { container } = render(<Logo />);
    expect(container.textContent).not.toContain('CareLoop');
  });

  it('renders "CareLoop" and subtitle when withText is true', () => {
    const { container } = render(<Logo withText />);
    expect(container.textContent).toContain('CareLoop');
    expect(screen.getByText('Infinite Health')).toBeInTheDocument();
  });

  it('hides subtitle when size is sm', () => {
    render(<Logo withText size="sm" />);
    expect(screen.queryByText('Infinite Health')).not.toBeInTheDocument();
  });

  it('applies a custom className to the wrapper', () => {
    const { container } = render(<Logo className="test-class" />);
    expect(container.firstChild).toHaveClass('test-class');
  });
});
