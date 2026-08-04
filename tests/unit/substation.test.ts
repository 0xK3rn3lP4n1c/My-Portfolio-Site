import { describe, it, expect } from 'vitest';
import { createSubstation, FLAG } from '../../src/components/lab/substationEngine';

const kinds = (r: { lines: { kind: string }[] }) => r.lines.map((l) => l.kind);
const text = (r: { lines: { text: string }[] }) => r.lines.map((l) => l.text).join('\n');

describe('substation engine', () => {
  it('starts energised with all breakers closed', () => {
    const s = createSubstation();
    const st = s.getState();
    expect(st.busEnergized).toBe(true);
    expect(st.busVoltage).toBe(110);
    expect(st.protectionEnabled).toBe(true);
    expect(st.breakers.CB01.closed).toBe(true);
    expect(st.won).toBe(false);
  });

  it('blocks a trip while protection is healthy (interlock)', () => {
    const s = createSubstation();
    s.execute('iec104 select 1001');
    const r = s.execute('iec104 execute 1001 off');
    expect(kinds(r)).toContain('err');
    expect(text(r)).toMatch(/interlock/i);
    expect(s.getState().breakers.CB01.closed).toBe(true); // unchanged
    expect(s.getState().won).toBe(false);
  });

  it('enforces select-before-operate', () => {
    const s = createSubstation();
    const r = s.execute('iec104 execute 1001 off'); // no select
    expect(text(r)).toMatch(/SBO violation/i);
  });

  it('disables protection over IEC 61850 MMS', () => {
    const s = createSubstation();
    const r = s.execute('iec61850 write PROT1/LLN0.Mod off');
    expect(kinds(r)).toContain('ok');
    expect(s.getState().protectionEnabled).toBe(false);
  });

  it('completes the Industroyer-style kill chain to blackout + flag', () => {
    const s = createSubstation();
    s.execute('iec104 interrogate');
    expect(s.getState().interrogated).toBe(true);
    s.execute('iec61850 write PROT1/LLN0.Mod off');
    s.execute('iec104 select 1001');
    const r = s.execute('iec104 execute 1001 off');
    expect(r.justWon).toBe(true);
    expect(kinds(r)).toContain('flag');
    expect(text(r)).toContain(FLAG);
    const st = s.getState();
    expect(st.busEnergized).toBe(false);
    expect(st.busVoltage).toBe(0);
    expect(st.won).toBe(true);
  });

  it('does not re-fire the win on a second trip', () => {
    const s = createSubstation();
    s.execute('iec61850 write PROT1/LLN0.Mod off');
    s.execute('iec104 select 1001');
    s.execute('iec104 execute 1001 off'); // win
    s.execute('iec104 select 1002');
    const r = s.execute('iec104 execute 1002 off'); // already blacked out
    expect(r.justWon).toBe(false);
  });

  it('tripping a feeder first does not black out the whole bus', () => {
    const s = createSubstation();
    s.execute('iec61850 write PROT1/LLN0.Mod off');
    s.execute('iec104 select 1002');
    const r = s.execute('iec104 execute 1002 off');
    expect(r.justWon).toBe(false);
    expect(s.getState().busEnergized).toBe(true); // CB-01 still holds
    expect(s.getState().breakers.CB02.closed).toBe(false);
  });

  it('rejects unknown commands', () => {
    const s = createSubstation();
    expect(text(s.execute('rm -rf /'))).toMatch(/Unknown command/i);
  });
});
