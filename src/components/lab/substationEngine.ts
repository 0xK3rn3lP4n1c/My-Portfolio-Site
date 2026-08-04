/**
 * Substation HMI lab — pure engine (no DOM).
 *
 * A deliberately simplified but protocol-flavoured model of an East 110 kV substation,
 * built to let a visitor re-play the 2016 Industroyer / CrashOverride attack pattern:
 *   1. IEC 60870-5-104 general interrogation to map the field  (recon)
 *   2. IEC 61850 MMS write to disable the protection relay      (defeat the interlock)
 *   3. IEC-104 select-before-operate trip of the line breaker   (open the breaker)
 *   -> total busbar de-energisation = simulated blackout        (flag)
 *
 * Everything here is a client-side make-believe: no network, no real protocol stack,
 * no secrets. It exists to teach, not to control anything. Kept DOM-free so it can be
 * unit-tested and so the page only has to render state.
 */

export const FLAG = 'OKC{lights_0ut_kyiv_2016}';

export type LineKind = 'echo' | 'info' | 'ok' | 'err' | 'lesson' | 'flag' | 'alarm';
export interface Line {
  kind: LineKind;
  text: string;
}

export interface Breaker {
  ioa: number;
  label: string;
  closed: boolean;
}

export interface SubState {
  breakers: Record<'CB01' | 'CB02' | 'CB03', Breaker>;
  protectionEnabled: boolean;
  selection: number | null; // SBO-selected IOA, if any
  busEnergized: boolean;
  busVoltage: number; // kV
  scanned: boolean;
  interrogated: boolean;
  won: boolean;
  /** Rolling event feed shown on the HMI alarm strip (newest last). */
  events: string[];
}

export interface ExecResult {
  lines: Line[];
  /** True on the transition that first triggers the blackout. */
  justWon: boolean;
}

const RTU = '192.168.95.10';
const RELAY = '192.168.95.11';

export function createSubstation() {
  const state: SubState = {
    breakers: {
      CB01: { ioa: 1001, label: '110 kV Incoming Line', closed: true },
      CB02: { ioa: 1002, label: 'Feeder A (Town)', closed: true },
      CB03: { ioa: 1003, label: 'Feeder B (Industrial)', closed: true },
    },
    protectionEnabled: true,
    selection: null,
    busEnergized: true,
    busVoltage: 110,
    scanned: false,
    interrogated: false,
    won: false,
    events: [],
  };

  const byIoa = (ioa: number): Breaker | undefined =>
    Object.values(state.breakers).find((b) => b.ioa === ioa);

  const event = (text: string) => {
    state.events.push(text);
    if (state.events.length > 8) state.events.shift();
  };

  const recompute = (): boolean => {
    // The bus is live only while the incoming line breaker holds.
    state.busEnergized = state.breakers.CB01.closed;
    state.busVoltage = state.busEnergized ? 110 : 0;
    const totalLoss = !state.busEnergized;
    if (totalLoss && !state.won) {
      state.won = true;
      return true;
    }
    return false;
  };

  function help(): Line[] {
    return [
      { kind: 'info', text: 'Engineering console — issue field commands to the RTU. Available:' },
      { kind: 'info', text: '  scan                         discover reachable OT endpoints' },
      { kind: 'info', text: '  status                       show the current process image' },
      { kind: 'info', text: '  iec104 interrogate           C_IC_NA_1 general interrogation (dump IOAs)' },
      { kind: 'info', text: '  iec104 select  <IOA>         C_SC_NA_1 select  (SBO, step 1)' },
      { kind: 'info', text: '  iec104 execute <IOA> on|off  C_SC_NA_1 execute (SBO, step 2)' },
      { kind: 'info', text: '  iec61850 read  <ref>         MMS read  (e.g. PROT1/LLN0.Mod)' },
      { kind: 'info', text: '  iec61850 write <ref> <val>   MMS write (e.g. PROT1/LLN0.Mod off)' },
      { kind: 'info', text: '  help                         this list' },
    ];
  }

  function scan(): Line[] {
    state.scanned = true;
    event('recon: OT endpoints enumerated');
    return [
      { kind: 'ok', text: 'Scanning 192.168.95.0/24 for industrial services ...' },
      { kind: 'info', text: `  ${RTU}:2404   open   IEC 60870-5-104 (RTU, station gateway)` },
      { kind: 'info', text: `  ${RTU}:102    open   IEC 61850 MMS   (bay controller)` },
      { kind: 'info', text: `  ${RELAY}:102    open   IEC 61850 MMS   (PROT-1 protection relay)` },
      { kind: 'lesson', text: '▸ OT protocols ship with no authentication and no encryption. Reachability is control.' },
    ];
  }

  function status(): Line[] {
    const b = state.breakers;
    const on = (x: Breaker) => (x.closed ? 'CLOSED' : 'OPEN');
    return [
      { kind: 'info', text: `RTU ${RTU}  ·  busbar ${state.busVoltage.toFixed(1)} kV  ·  ${state.busEnergized ? 'ENERGISED' : 'DEAD'}` },
      { kind: 'info', text: `  IOA ${b.CB01.ioa}  CB-01  ${b.CB01.label.padEnd(22)} ${on(b.CB01)}` },
      { kind: 'info', text: `  IOA ${b.CB02.ioa}  CB-02  ${b.CB02.label.padEnd(22)} ${on(b.CB02)}` },
      { kind: 'info', text: `  IOA ${b.CB03.ioa}  CB-03  ${b.CB03.label.padEnd(22)} ${on(b.CB03)}` },
      { kind: 'info', text: `  PROT-1 protection: ${state.protectionEnabled ? 'HEALTHY (interlock active)' : 'DISABLED'}` },
    ];
  }

  function interrogate(): Line[] {
    state.interrogated = true;
    event('IEC-104 general interrogation received');
    const b = state.breakers;
    const dp = (x: Breaker) => (x.closed ? 'ON  (closed)' : 'OFF (open)');
    return [
      { kind: 'ok', text: `-> ${RTU}:2404  C_IC_NA_1 (GI)  COT=6 (activation)` },
      { kind: 'info', text: `<- M_SP_NA_1  IOA ${b.CB01.ioa}  CB-01 ${dp(b.CB01)}` },
      { kind: 'info', text: `<- M_SP_NA_1  IOA ${b.CB02.ioa}  CB-02 ${dp(b.CB02)}` },
      { kind: 'info', text: `<- M_SP_NA_1  IOA ${b.CB03.ioa}  CB-03 ${dp(b.CB03)}` },
      { kind: 'info', text: `<- M_ME_NC_1  IOA 2001  busbar ${state.busVoltage.toFixed(1)} kV` },
      { kind: 'info', text: `<- M_SP_NA_1  IOA 3001  PROT-1.Mod ${state.protectionEnabled ? 'ON' : 'OFF'}` },
      { kind: 'lesson', text: '▸ One unauthenticated GI on TCP/2404 hands an attacker the entire process image.' },
    ];
  }

  function iec104(args: string[]): Line[] {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'interrogate' || sub === 'gi') return interrogate();

    if (sub === 'select') {
      const ioa = Number(args[1]);
      const brk = byIoa(ioa);
      if (!brk) return [{ kind: 'err', text: `No controllable object at IOA ${args[1] ?? '?'}. Try 'iec104 interrogate'.` }];
      state.selection = ioa;
      return [{ kind: 'ok', text: `-> C_SC_NA_1 SELECT  IOA ${ioa} (${brk.label}). Qualifier S/E=select. Awaiting execute.` }];
    }

    if (sub === 'execute') {
      const ioa = Number(args[1]);
      const cmd = (args[2] || '').toLowerCase();
      const brk = byIoa(ioa);
      const selected = state.selection;
      state.selection = null; // SBO: any execute consumes the selection
      if (!brk) return [{ kind: 'err', text: `No controllable object at IOA ${args[1] ?? '?'}.` }];
      if (selected !== ioa) {
        return [{ kind: 'err', text: `SBO violation: no active SELECT for IOA ${ioa}. Issue 'iec104 select ${ioa}' first.` }];
      }
      if (cmd !== 'on' && cmd !== 'off') {
        return [{ kind: 'err', text: "Command value must be 'on' (close) or 'off' (trip)." }];
      }
      if (cmd === 'off') {
        if (state.protectionEnabled) {
          return [
            { kind: 'err', text: `-> C_SC_NA_1 EXECUTE trip IOA ${ioa}  ...  REJECTED` },
            { kind: 'err', text: '   Bay interlock active — PROT-1 protection healthy. Trip blocked.' },
            { kind: 'lesson', text: "▸ Protection relays are the last line of defence. In 2016 the attackers didn't bypass them — they switched them off first." },
          ];
        }
        brk.closed = false;
        event(`CB trip: IOA ${ioa} (${brk.label}) OPEN`);
        const justWon = recompute();
        const out: Line[] = [{ kind: 'ok', text: `-> C_SC_NA_1 EXECUTE trip IOA ${ioa}  ...  ACT-CON. Breaker OPEN.` }];
        if (justWon) {
          event('BUSBAR DEAD — TOTAL LOAD LOSS');
          out.push({ kind: 'alarm', text: '*** BUSBAR DE-ENERGISED — SUBSTATION BLACKOUT ***' });
        } else if (!state.breakers.CB01.closed) {
          // already blacked out earlier
        } else {
          out.push({ kind: 'info', text: 'Feeder tripped. The 110 kV line breaker CB-01 is still holding the bus.' });
        }
        return out;
      }
      // close
      brk.closed = true;
      event(`CB close: IOA ${ioa} (${brk.label}) CLOSED`);
      recompute();
      return [{ kind: 'ok', text: `-> C_SC_NA_1 EXECUTE close IOA ${ioa}  ...  ACT-CON. Breaker CLOSED.` }];
    }

    return [{ kind: 'err', text: "Unknown IEC-104 verb. Try: interrogate | select <IOA> | execute <IOA> on|off" }];
  }

  function iec61850(args: string[]): Line[] {
    const sub = (args[0] || '').toLowerCase();
    const ref = (args[1] || '');
    const isProtMod = /^prot1\/(lln0\.mod|ptrc1\.)/i.test(ref) || /^prot1\/lln0\.mod$/i.test(ref);

    if (sub === 'read') {
      if (!ref) return [{ kind: 'err', text: 'Usage: iec61850 read <LD/LN.DO>  e.g. PROT1/LLN0.Mod' }];
      if (isProtMod) {
        return [{ kind: 'info', text: `<- MMS read  PROT1/LLN0.Mod = ${state.protectionEnabled ? 'on (1)' : 'off (4)'}  [${state.protectionEnabled ? 'HEALTHY' : 'DISABLED'}]` }];
      }
      return [{ kind: 'info', text: `<- MMS read  ${ref} = <object exists, value withheld>` }];
    }

    if (sub === 'write') {
      const val = (args[2] || '').toLowerCase();
      if (!ref) return [{ kind: 'err', text: 'Usage: iec61850 write <LD/LN.DO> <value>  e.g. PROT1/LLN0.Mod off' }];
      if (isProtMod) {
        if (val === 'off' || val === '4' || val === 'blocked') {
          if (!state.protectionEnabled) {
            return [{ kind: 'info', text: 'PROT-1 protection already disabled.' }];
          }
          state.protectionEnabled = false;
          event('PROT-1 protection DISABLED via MMS');
          return [
            { kind: 'ok', text: '-> MMS write PROT1/LLN0.Mod := off  ...  +ACK. Protection element OFF.' },
            { kind: 'alarm', text: 'PROTECTION DISABLED — bay interlock cleared.' },
            { kind: 'lesson', text: '▸ IEC 61850 MMS on TCP/102 let Industroyer command relays directly; a sister module could brick SIPROTEC relays outright (CVE-2015-5374).' },
          ];
        }
        if (val === 'on' || val === '1') {
          state.protectionEnabled = true;
          event('PROT-1 protection re-enabled');
          return [{ kind: 'ok', text: '-> MMS write PROT1/LLN0.Mod := on  ...  +ACK. Protection restored.' }];
        }
        return [{ kind: 'err', text: "Value must be 'on' or 'off'." }];
      }
      return [{ kind: 'err', text: `Object ${ref} is not writable from here (or does not exist). Hint: the protection relay is PROT1/LLN0.Mod.` }];
    }

    return [{ kind: 'err', text: 'Unknown IEC 61850 verb. Try: read <ref> | write <ref> <val>' }];
  }

  function execute(raw: string): ExecResult {
    const input = raw.trim();
    if (!input) return { lines: [], justWon: false };
    const wonBefore = state.won;
    const tokens = input.split(/\s+/);
    const head = tokens[0].toLowerCase();
    const rest = tokens.slice(1);

    let lines: Line[];
    switch (head) {
      case 'help':
      case '?':
        lines = help();
        break;
      case 'scan':
      case 'nmap':
        lines = scan();
        break;
      case 'status':
        lines = status();
        break;
      case 'iec104':
      case '104':
        lines = iec104(rest);
        break;
      case 'iec61850':
      case '61850':
      case 'mms':
        lines = iec61850(rest);
        break;
      case 'clear':
      case 'cls':
        lines = [{ kind: 'info', text: 'clear' }]; // sentinel handled by the UI
        break;
      default:
        lines = [{ kind: 'err', text: `Unknown command: ${tokens[0]}. Type 'help'.` }];
    }

    const justWon = !wonBefore && state.won;
    if (justWon) {
      lines = lines.concat([
        { kind: 'flag', text: FLAG },
        { kind: 'lesson', text: '▸ You just re-played Industroyer (2016): map with IEC-104, silence protection over IEC 61850, then trip the breakers. BlackEnergy did the same by hijacking the operators’ own HMI a year earlier.' },
      ]);
    }
    return { lines, justWon };
  }

  return {
    execute,
    getState: (): SubState => state,
    FLAG,
  };
}

export type Substation = ReturnType<typeof createSubstation>;
