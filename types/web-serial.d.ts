// Tipagem mínima da Web Serial API (Chrome/Edge) — ainda não faz parte do
// lib.dom.d.ts padrão do TypeScript. Cobre só o que lib/serial-balanca.ts
// usa. Sem imports/exports de propósito: precisa ficar como script global
// pra fazer merge com as interfaces DOM existentes (Navigator).

interface SerialPortOpenOptions {
  baudRate: number;
  dataBits?: 7 | 8;
  stopBits?: 1 | 2;
  parity?: "none" | "even" | "odd";
}

interface SerialPort {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: SerialPortOpenOptions): Promise<void>;
  close(): Promise<void>;
}

interface SerialPortRequestOptions {
  filters?: Array<{ usbVendorId?: number; usbProductId?: number }>;
}

interface Serial extends EventTarget {
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface Navigator {
  serial?: Serial;
}
