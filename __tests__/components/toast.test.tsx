import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider, toast } from '@/components/ui/toast';

describe('toast accessibility', () => {
  it('renders the viewport as a polite live region', () => {
    const html = renderToStaticMarkup(React.createElement(ToastProvider));
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-atomic="false"');
  });

  it('gives destructive toasts role="alert" and others none', () => {
    toast({ title: 'Saved', variant: 'success', duration: 100000 });
    toast({ title: 'Heads up', duration: 100000 });
    toast({ title: 'Failed', variant: 'destructive', duration: 100000 });

    const html = renderToStaticMarkup(React.createElement(ToastProvider));
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toContain('Failed');
    expect(html).toContain('Saved');
    expect(html).toContain('Heads up');
  });

  it('hides decorative icons and does not leak id/duration to the DOM', () => {
    const html = renderToStaticMarkup(React.createElement(ToastProvider));
    expect(html).not.toMatch(/<svg(?![^>]*aria-hidden="true")/);
    expect(html).not.toContain('duration=');
    expect(html).not.toMatch(/ id="\d+"/);
  });
});
