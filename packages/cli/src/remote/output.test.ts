import { describe, it, expect, vi, afterEach } from 'vitest';
import { emitResult, info, spinner } from './output';

describe('emitResult', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prints structured JSON to stdout under --json and skips the human formatter', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const human = vi.fn();
    emitResult({ json: true }, { mediaItemId: 'med_1', count: 3 }, human);
    expect(human).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      JSON.stringify({ mediaItemId: 'med_1', count: 3 }, null, 2),
    );
  });

  it('runs the human formatter and prints nothing of its own when not --json', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const human = vi.fn();
    emitResult({ json: false }, { foo: 'bar' }, human);
    expect(human).toHaveBeenCalledOnce();
    expect(log).not.toHaveBeenCalled();
  });

  it('treats undefined json as false (default human path)', () => {
    const human = vi.fn();
    emitResult({}, { x: 1 }, human);
    expect(human).toHaveBeenCalledOnce();
  });
});

describe('info', () => {
  afterEach(() => vi.restoreAllMocks());

  it('writes the line to stdout when not --json', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    info('hello', { json: false });
    expect(log).toHaveBeenCalledWith('hello');
  });

  it('is a no-op under --json', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    info('hello', { json: true });
    expect(log).not.toHaveBeenCalled();
  });
});

describe('spinner', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns a started spinner instance', () => {
    const sp = spinner('working…', false);
    expect(typeof sp.succeed).toBe('function');
    expect(typeof sp.fail).toBe('function');
    sp.stop();
  });

  it('silences the spinner under --json', () => {
    const sp = spinner('working…', true);
    expect(sp.isSpinning).toBe(false);
    sp.succeed('done');
    sp.stop();
  });
});
